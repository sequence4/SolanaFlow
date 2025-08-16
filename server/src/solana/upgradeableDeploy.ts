import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  SendTransactionError,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { Buffer } from 'buffer';

// BPF Upgrade Loader ID - same as in the client code
const BPF_UPGRADE_LOADER_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

// Helper functions for instruction data
function u32LE(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

function u64LE(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n, 0);
  return b;
}

// Create instruction data helpers
function createInitializeBufferData(): Buffer {
  return u32LE(0); // InitializeBuffer tag
}

function createWriteBufferData(offset: number, data: Buffer): Buffer {
  const offsetBuf = u32LE(offset);
  const lenBuf = u64LE(BigInt(data.length));
  return Buffer.concat([u32LE(1), offsetBuf, lenBuf, data]);
}

function createDeployInstructionData(maxDataLen: number): Buffer {
  return Buffer.concat([u32LE(2), u64LE(BigInt(maxDataLen))]);
}

function createUpgradeInstructionData(): Buffer {
  return u32LE(3);
}

function createSetAuthorityInstructionData(): Buffer {
  return u32LE(4);
}

// Check buffer authority helper
async function checkBufferAuthority(
  connection: Connection,
  bufferPubkey: PublicKey
): Promise<PublicKey | null> {
  try {
    const accountInfo = await connection.getAccountInfo(bufferPubkey);
    if (!accountInfo) return null;
    
    // Buffer header = 4-byte state enum + 1-byte COption + 32-byte authority = 37 bytes
    // If COption (at offset 4) is 0, there's no authority
    if (accountInfo.data[4] === 0) return null;
    
    // Otherwise, extract the authority pubkey from the buffer
    return new PublicKey(accountInfo.data.slice(5, 37));
  } catch (err) {
    console.error('Error checking buffer authority:', err);
    return null;
  }
}

/**
 * Deploy or upgrade a Solana program using the upgradeable loader
 * This implementation properly handles buffer authority transfers and signing
 * 
 * @param connection - Solana connection
 * @param walletPk - Wallet public key (final upgrade authority)
 * @param signAndSend - Function to sign and send transactions
 * @param programData - Program binary data (.so file)
 * @param deployOption - Whether to use delegated authority for faster writes
 * @returns The program's public key
 */
export async function deployOrUpgradeUpgradeable(
  connection: Connection,
  walletPk: PublicKey,
  signAndSend: (tx: Transaction, signers?: Keypair[]) => Promise<string>,
  programData: Buffer,
  deployOption: 'fullWallet' | 'delegated' = 'delegated'
): Promise<PublicKey> {
  console.log('Starting deployOrUpgradeUpgradeable');
  
  // Create buffer account
  const bufferAccount = Keypair.generate();
  const bufferSpace = 37 + programData.length; // Buffer header + program data
  const rentExemptionAmt = await connection.getMinimumBalanceForRentExemption(bufferSpace);
  
  // Create and initialize buffer
  const createBufferIx = SystemProgram.createAccount({
    fromPubkey: walletPk,
    lamports: rentExemptionAmt,
    newAccountPubkey: bufferAccount.publicKey,
    space: bufferSpace,
    programId: BPF_UPGRADE_LOADER_ID,
  });
  
  const bufferInitIx = new TransactionInstruction({
    programId: BPF_UPGRADE_LOADER_ID,
    keys: [
      { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
      { pubkey: walletPk, isSigner: true, isWritable: false },
    ],
    data: createInitializeBufferData(),
  });
  
  let transaction = new Transaction().add(createBufferIx, bufferInitIx);
  try {
    // The wallet (phantom) is a signer here, so use signAndSendTransaction to collect its signature
    await signAndSend(transaction, [bufferAccount]);
    console.log('Buffer created and initialized');
  } catch (err) {
    if (err instanceof SendTransactionError) {
      console.error('Buffer creation error logs:', err.logs);
    }
    throw err;
  }
  
  // Track the current buffer authority
  let currentBufferAuthority = walletPk;
  let ephemeralKeypair: Keypair | undefined;
  
  // Optionally delegate authority to ephemeral keypair for faster writes
  if (deployOption === 'delegated') {
    ephemeralKeypair = Keypair.generate();
    console.log('Using ephemeral keypair for buffer writes:', ephemeralKeypair.publicKey.toBase58());
    
    // Transfer authority to ephemeral keypair
    const setAuthorityIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
        { pubkey: currentBufferAuthority, isSigner: true, isWritable: false },
        { pubkey: ephemeralKeypair.publicKey, isSigner: false, isWritable: false },
      ],
      data: createSetAuthorityInstructionData(),
    });
    
    transaction = new Transaction().add(setAuthorityIx);
    // Wallet must sign the SetAuthority instruction; call signAndSend
    await signAndSend(transaction);
    console.log('Authority transferred to ephemeral key');
    
    // Update current authority
    currentBufferAuthority = ephemeralKeypair.publicKey;
  }
  
  // Write program data in chunks
  const CHUNK_SIZE = 900; // Safe size for instructions
  for (let offset = 0; offset < programData.length; offset += CHUNK_SIZE) {
    const end = Math.min(offset + CHUNK_SIZE, programData.length);
    const chunk = programData.slice(offset, end);
    
    const writeIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
        { pubkey: currentBufferAuthority, isSigner: true, isWritable: false },
      ],
      data: createWriteBufferData(offset, chunk),
    });
    
    transaction = new Transaction().add(writeIx);
    
    if (deployOption === 'delegated') {
      // For write instructions with ephemeral key, the wallet is not a signer
      // Use connection.sendRawTransaction with only the buffer authority
      transaction.feePayer = ephemeralKeypair!.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
      transaction.sign(ephemeralKeypair!);
      await connection.sendRawTransaction(transaction.serialize(), { 
        skipPreflight: false, 
        preflightCommitment: 'confirmed' 
      });
    } else {
      // For wallet-only mode, the wallet needs to sign
      await signAndSend(transaction);
    }
    
    console.log(`Wrote chunk at offset ${offset}, size ${chunk.length}`);
  }
  
  // If we used delegated authority, transfer it back to wallet
  if (deployOption === 'delegated' && ephemeralKeypair) {
    const revertAuthorityIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
        { pubkey: currentBufferAuthority, isSigner: true, isWritable: false },
        { pubkey: walletPk, isSigner: false, isWritable: false },
      ],
      data: createSetAuthorityInstructionData(),
    });
    
    transaction = new Transaction().add(revertAuthorityIx);
    // Both the wallet (new authority) and the current buffer authority must sign
    await signAndSend(transaction, [ephemeralKeypair]);
    console.log('Authority reverted to wallet');
    
    // Update current authority
    currentBufferAuthority = walletPk;
  }
  
  // Generate program keypair
  const programKeypair = Keypair.generate();
  const programPk = programKeypair.publicKey;
  
  // Find PDA for program data
  const [programDataPk] = PublicKey.findProgramAddressSync(
    [programPk.toBuffer()],
    BPF_UPGRADE_LOADER_ID
  );
  
  // Create program account
  const programRent = await connection.getMinimumBalanceForRentExemption(36);
  const createProgramAcct = SystemProgram.createAccount({
    fromPubkey: walletPk,
    newAccountPubkey: programPk,
    lamports: programRent,
    space: 36,
    programId: BPF_UPGRADE_LOADER_ID,
  });
  
  // Deploy with max data length
  const deployIx = new TransactionInstruction({
    programId: BPF_UPGRADE_LOADER_ID,
    keys: [
      { pubkey: walletPk, isSigner: true, isWritable: true },
      { pubkey: programDataPk, isSigner: false, isWritable: true },
      { pubkey: programPk, isSigner: false, isWritable: true },
      { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // The current buffer authority must sign here
      { pubkey: currentBufferAuthority, isSigner: true, isWritable: false },
    ],
    data: createDeployInstructionData(programData.length),
  });
  
  // Create final transaction
  const deployTx = new Transaction()
    .add(createProgramAcct)
    .add(deployIx);
  
  // Wallet must sign along with programKeypair; use signAndSend
  await signAndSend(deployTx, [programKeypair]);
  console.log('Program deployed successfully:', programPk.toBase58());
  
  return programPk;
}