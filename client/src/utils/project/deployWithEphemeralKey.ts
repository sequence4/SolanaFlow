import { Connection, PublicKey, Keypair, TransactionInstruction, Transaction, VersionedTransaction } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { deployWithEphemeralKey } from '../../lib/ephemeralDeployment';
import bs58 from 'bs58';
import { projectApi } from '../../api/projectApi';
import { toast } from 'sonner';
import { createAndRegisterEphemeral } from '@/utils/ephemeral/ephemeralKey';
import { BPF_UPGRADE_LOADER_ID } from '@/utils/helpers/constants';

/**
 * Handles the deployment of a Solana program using an ephemeral key approach
 * to avoid blockhash not found errors when deploying large programs
 */
export async function handleEphemeralDeploy(
  projectId: string,
  programSoData: ArrayBuffer,
  connection: Connection,
  wallet: WalletContextState,
  onProgress: (progress: number, message: string) => void
) {
  try {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected or does not support signing');
    }

    onProgress(0, 'Starting ephemeral key deployment...');

    // 1. Generate an in-memory Keypair; it signs chunk uploads
    const ephem = Keypair.generate();

    // 2. Fetch the code-generated program ID from the server
    const projectDetails = await projectApi.getProjectDetails(projectId);
    const storedProgramId = (projectDetails?.details?.projectState?.programId ?? projectDetails?.details?.programId) as string | undefined;
    if (!storedProgramId) {
      throw new Error('Program ID not found. Did you run code generation first?');
    }
    const programPubKey = new PublicKey(storedProgramId);

    // 3. Build a partial deploy transaction (signed only by the buffer authority)
    const deployResult = await deployWithEphemeralKey({
      soBytes: programSoData,
      connection,
      wallet,
      ephemeralKeypair: ephem,
      programId: programPubKey,
      relayToBackend: true,
      onProgress,
    });

    if (!deployResult.relayPending || !deployResult.encodedTx) {
      throw new Error('Unexpected result: encoded transaction missing.');
    }

    onProgress(80, 'Sending partial deploy transaction to backend for signature...');

    // 4. Ask the backend to sign; if wallet signature required, sign and retry
    const firstRelay = await projectApi.relayTx(projectId, {
      encodedTx: deployResult.encodedTx,
      programId: storedProgramId,
    });
    let finalSig: string | undefined;
    if ('signature' in firstRelay) {
      finalSig = firstRelay.signature;
    } else if (firstRelay.code === 'WALLET_SIGNATURE_REQUIRED' && firstRelay.txBase64) {
      // Deserialize as versioned or legacy
      const raw = Buffer.from(firstRelay.txBase64, 'base64');
      const tx: Transaction | VersionedTransaction = (raw[0] === 0x80)
        ? VersionedTransaction.deserialize(raw)
        : Transaction.from(raw);
      // Compute message for both legacy and versioned transactions
      const msg = (tx as any).message ?? (tx as Transaction).compileMessage();
      const required = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
      const walletIsRequired = required.some((k: PublicKey) => k.equals(wallet.publicKey!));
      if (!walletIsRequired) {
        throw new Error(
          'Server 409 payload does not include the wallet as a required signer. ' +
          'Fix: ensure tx.feePayer = walletPublicKey before returning the 409.'
        );
      }
      // Ensure wallet is among required signers (first numRequiredSignatures)
      const signed = await wallet.signTransaction!(tx as any);
      const secondRelay = await projectApi.relayTx(projectId, {
        encodedTx: signed.serialize({ requireAllSignatures: false }).toString('base64'),
        programId: storedProgramId,
      });
      if ('signature' in secondRelay) {
        finalSig = secondRelay.signature;
      } else {
        throw new Error(`Still missing signatures: ${secondRelay.missing?.join(', ')}`);
      }
    } else {
      throw new Error('Unexpected relay response; wallet-sign not requested');
    }

    onProgress(90, 'Backend signed deploy transaction; transferring upgrade authority…');

    // 5. Transfer upgrade authority from the buffer authority (ephem) to the wallet
    const [programDataPubkey] = PublicKey.findProgramAddressSync(
      [programPubKey.toBuffer()],
      BPF_UPGRADE_LOADER_ID,
    );
    // Prepare instruction to set authority (LoaderIx.SetAuthority = 4)
    const data = Buffer.alloc(4);
    data.writeUInt32LE(4, 0);
    const setAuthIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: programDataPubkey, isSigner: false, isWritable: true },
        { pubkey: ephem.publicKey, isSigner: true, isWritable: false },
        { pubkey: wallet.publicKey!, isSigner: false, isWritable: false },
      ],
      data,
    });
    const setAuthTx = new Transaction().add(setAuthIx);
    setAuthTx.feePayer = ephem.publicKey;
    const { blockhash: authHash, lastValidBlockHeight: authHeight } = await connection.getLatestBlockhash('confirmed');
    setAuthTx.recentBlockhash = authHash;
    setAuthTx.sign(ephem);
    const setSig = await connection.sendRawTransaction(setAuthTx.serialize(), {
      skipPreflight: false,
    });
    await connection.confirmTransaction(
      { signature: setSig, blockhash: authHash, lastValidBlockHeight: authHeight },
      'confirmed',
    );

    onProgress(98, 'Upgrade authority transferred; saving program ID…');

    // 6. Persist the program ID on the server
    await projectApi.updateProject(projectId, {
      details: {
        projectState: {
          programId: storedProgramId,
        },
      },
    });

    onProgress(100, 'Deployment complete!');

    return {
      success: true,
      programId: storedProgramId,
      signatures: [...deployResult.signatures, finalSig!, setSig],
    };
  } catch (error: any) {
    console.error('Ephemeral deployment failed:', error);
    toast.error(`Deployment failed: ${error.message}`);
    
    return {
      success: false,
      error: error.message
    };
  }
} 