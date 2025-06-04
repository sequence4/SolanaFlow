import {
  Connection,
  PublicKey,
  TransactionInstruction,
  Transaction,
  SendTransactionError,
  SystemProgram,
  Keypair,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { rpcWithRetry } from "./rpcRetry";

// Helper function for little-endian u32 encoding
function leU32(n: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n, 0);
  return buf;
}

// Helper function for little-endian u64 encoding
function leU64(n: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(n, 0);
  return buf;
}

const BPF_UPGRADE_LOADER_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const CHUNK_SIZE = 900; // Standard chunk size for Solana BPF loader
const HEADER_LEN = 40;  // 4 (tag) + 4 (discr) + 32 (pubkey)
// Phantom (and most wallets) will not sign more than ~64 txs in one call
const MAX_BATCH = 60;          // stay comfortably under the cap

type DeployProgress = {
  stage: 'create' | 'write' | 'deploy' | 'complete';
  uploaded: number;
  total: number;
  chunkIndex?: number;
  totalChunks?: number;
};

type DeployOptions = {
  soBytes: ArrayBuffer;
  connection: Connection;
  wallet: WalletContextState;
  programId?: PublicKey;
  onProgress?: (progress: DeployProgress) => void;
};

type DeployResult = {
  programId: PublicKey;
  signatures: string[];
};

/**
 * Deploys a Solana program using the BPF Upgradeable Loader
 * This function implements the full deployment flow:
 * 1. Create buffer account
 * 2. Write program data in chunks
 * 3. Deploy program from buffer
 */
export async function deployUpgradeableProgram(options: DeployOptions): Promise<DeployResult> {
  const { soBytes, connection, wallet, onProgress, programId: userProvidedProgramId } = options;
  
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or doesn't support signing");
  }
  
  // Convert ArrayBuffer to Uint8Array for processing
  const programData = new Uint8Array(soBytes);
  const dataLength = programData.length;
  const bufferSpace = HEADER_LEN + dataLength;
  const signatures: string[] = [];
  
  console.log(`[DEPLOY] Starting program deployment, program size: ${dataLength} bytes`);
  
  // 1. Create a *real* buffer account (Keypair, not PDA)
  const bufferKey = Keypair.generate();
  const programKey = Keypair.generate();
  
  const [programDataPubkey] = PublicKey.findProgramAddressSync(
    [programKey.publicKey.toBuffer()],
    BPF_UPGRADE_LOADER_ID,
  );
  
  // Rent-exempt lamports for the buffer's exact length
  const lamports = await connection.getMinimumBalanceForRentExemption(bufferSpace);
  const progLamports = await connection.getMinimumBalanceForRentExemption(0);
  
  // If programId not provided, derive a new one
  const programId = userProvidedProgramId || programKey.publicKey;
  
  console.log(`[DEPLOY] Buffer: ${bufferKey.publicKey.toBase58()}`);
  console.log(`[DEPLOY] Program ID: ${programId.toBase58()}`);
  
  try {
    // 2. (a) Allocate the buffer with SystemProgram
    const createBufAcct = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey!,
      newAccountPubkey: bufferKey.publicKey,
      lamports,
      space: bufferSpace,
      programId: BPF_UPGRADE_LOADER_ID,
    });

    // 2. (b) Initialise the buffer: proper bincode serialization with tag and COption
    const initBufIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: bufferKey.publicKey, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey!,  isSigner: true,  isWritable: false },
      ],
      data: Buffer.concat([
        leU32(0),                     // tag = InitializeBuffer
        leU32(1),                     // COption::Some discriminant
        wallet.publicKey!.toBuffer(), // 32-byte authority pubkey
      ]),
    });
    
    const createProgAcct = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey!,
      newAccountPubkey: programKey.publicKey,
      lamports: progLamports,
      space: 0,                       // program acct stores only a pointer
      programId: BPF_UPGRADE_LOADER_ID,
    });

    onProgress?.({ stage: 'create', uploaded: 0, total: dataLength });

    const createBufferTx = new Transaction()
      .add(createBufAcct)   // create account
      .add(initBufIx);      // initialise buffer, authority = wallet
    
    createBufferTx.feePayer = wallet.publicKey;
    const { value: { blockhash } } =
      await rpcWithRetry<{ value: { blockhash: string } }>(connection, "getLatestBlockhash",
        [{ commitment: "processed" }], "processed");
    createBufferTx.recentBlockhash = blockhash;
    
    // Sign with wallet + bufferKey
    createBufferTx.partialSign(bufferKey);
    const signedCreateBufferTx = await wallet.signTransaction(createBufferTx);
    const createBufferSig = await connection.sendRawTransaction(signedCreateBufferTx.serialize());
    signatures.push(createBufferSig);
    
    // Wait for confirmation
    await connection.confirmTransaction(createBufferSig);
    console.log(`[DEPLOY] Buffer created successfully. Signature: ${createBufferSig}`);
    
    // 3. Write program data in chunks
    const numChunks = Math.ceil(dataLength / CHUNK_SIZE);
    console.log(`[DEPLOY] Writing program data in ${numChunks} chunks of max ${CHUNK_SIZE} bytes each`);
    
    // Prepare an array to collect chunk uploads
    const writeTxs: Transaction[] = [];
    
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      // offset is from start of the payload area (after the 40-byte header)
      // this is correct for BPF loader which interprets offset from data start
      const offset = chunkIndex * CHUNK_SIZE;
      const chunkEnd = Math.min((chunkIndex + 1) * CHUNK_SIZE, dataLength);
      const chunkSize = chunkEnd - chunkIndex * CHUNK_SIZE;
      const chunk = programData.slice(chunkIndex * CHUNK_SIZE, chunkEnd);
      
      onProgress?.({
        stage: 'write',
        uploaded: chunkIndex * CHUNK_SIZE,
        total: dataLength,
        chunkIndex,
        totalChunks: numChunks
      });
      
      console.log(`[DEPLOY] Writing chunk ${chunkIndex + 1}/${numChunks}, offset: ${offset}, size: ${chunkSize} bytes`);
      
      // Loader instruction tag 1 = Write
      const writeIx = new TransactionInstruction({
        programId: BPF_UPGRADE_LOADER_ID,
        keys: [
          { pubkey: bufferKey.publicKey, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey!,   isSigner: true,  isWritable: false },
        ],
        data: Buffer.concat([
          leU32(1),                         // tag = Write
          leU32(offset),                    // offset
          leU64(BigInt(chunk.length)),      // bytes.len() as u64
          Buffer.from(chunk),               // raw bytes
        ]),
      });
      
      const writeTx = new Transaction().add(writeIx);
      writeTx.feePayer = wallet.publicKey!;
      writeTxs.push(writeTx);
      
      if (chunkIndex % 10 === 0) {
        // give the event-loop 1 ms
        await new Promise(requestAnimationFrame);
      }
    }
    
    const deployIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: wallet.publicKey!,        isSigner: true,  isWritable: true },
        { pubkey: programDataPubkey,        isSigner: false, isWritable: true },
        { pubkey: programKey.publicKey,     isSigner: true,  isWritable: true },
        { pubkey: bufferKey.publicKey,      isSigner: false, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY,       isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY,      isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
        { pubkey: wallet.publicKey!,        isSigner: true,  isWritable: false },
      ],
      data: Buffer.concat([
        leU32(2),                       // Loader instruction tag 2 = DeployWithMaxDataLen
        Buffer.from(new Uint32Array([bufferSpace]).buffer),
      ]),
    });
    
    const deployTx = new Transaction()
      .add(createProgAcct)   // program account
      .add(deployIx);
    
    deployTx.feePayer = wallet.publicKey!;
    
    writeTxs.push(deployTx);   // after the loop, before signAllTransactions
    
    // ── sign & send in safe-sized batches ──────────────────────────────────────────
    if (!wallet.signAllTransactions) {
      throw new Error("Wallet doesn't support signing multiple transactions");
    }

    let batchIndex = 0;
    for (let start = 0; start < writeTxs.length; ) {
      const slice = writeTxs.slice(start, start + MAX_BATCH);

      // IMPORTANT:
      //   ask for the *freshest* hash – use "processed" commitment.
      //   (default "finalized" can already be tens of seconds old ⇒ expires)
      const { value: { blockhash: batchHash, lastValidBlockHeight: lvh } } =
        await rpcWithRetry<{ value: { blockhash: string; lastValidBlockHeight: number } }>(
          connection, 
          "getLatestBlockhash",
          [{ commitment: "processed" }], 
          "processed"
        );
            
      if (batchIndex === 0) {
        // Wait half a second so the new hash is visible to the pre-flight bank.
        // This avoids "Blockhash not found" on the first tx of the batch.
        await new Promise(res => setTimeout(res, 600));
      }
      
      for (const tx of slice) {
        tx.recentBlockhash = batchHash;
        // re-sign deployTx now that it has its final hash
        if (tx === deployTx) {
          tx.partialSign(programKey);
        }
      }

      // Phantom sometimes shows the second prompt for a while.
      // ↓ If the user is slow **and** the hash expires, we refetch and retry.
      let signed: Transaction[];
      try {
        signed = await wallet.signAllTransactions(slice);
      } catch (e) {
        // very unlikely to throw here, but keep the code symmetric
        throw e;
      }

      console.log(`[DEPLOY] Sending batch ${++batchIndex} (${signed.length} txs)…`);

      for (const tx of signed) {
        // skipPreflight=false by default; but if this line still ever throws
        // "blockhash not found", try `skipPreflight:true` while debugging.
        // const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight:true });
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(
          { signature: sig, blockhash: batchHash, lastValidBlockHeight: lvh },
          'confirmed'
        );
        signatures.push(sig);
        
        // Throttle to stay under Helius rate limits (5 TPS)
        await new Promise(r => setTimeout(r, 350)); // 1000 ms / 3 tx ≈ 333 ms
      }
      
      // advance only after successful send
      start += MAX_BATCH;
    }
    console.log('[DEPLOY] All write chunks and deploy signed & confirmed');
    
    // 4. Deploy from buffer
    onProgress?.({
      stage: 'deploy',
      uploaded: dataLength,
      total: dataLength
    });
    
    console.log(`[DEPLOY] Program deployed successfully with ID: ${programId.toBase58()}`);
    
    onProgress?.({
      stage: 'complete',
      uploaded: dataLength,
      total: dataLength
    });
    
    return {
      programId,
      signatures
    };
  } catch (error) {
    console.error('[DEPLOY] Error during program deployment:', error);
    
    if (error instanceof SendTransactionError) {
      console.error('[DEPLOY] Transaction error details:', {
        logs: error.logs,
        message: error.message
      });
    }
    
    throw new Error(`Program deployment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
} 