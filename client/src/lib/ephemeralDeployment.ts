import { 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction, 
  SYSVAR_RENT_PUBKEY, 
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
  Connection
} from '@solana/web3.js';
import { BPF_UPGRADE_LOADER_ID } from '../utils/constants';
import type { WalletContextState } from '@solana/wallet-adapter-react';

// Maximum transaction size for Solana (in bytes)
const MAX_TRANSACTION_SIZE = 1232;

// Program data header length
const HEADER_LEN = 43; // 11 (serde) + 32 (program id)

// Chunk size for buffer writes (a bit smaller than max to allow for instruction overhead)
const CHUNK_SIZE = 900;

/**
 * Gets a blockhash that's already 45 blocks old, giving you ~105 blocks of validity
 * Only use this in very slow networks or when you need extra buffer time
 */
async function getSafeHash(conn: Connection): Promise<{ blockhash: string, lastValidBlockHeight: number }> {
  const { blockhash, lastValidBlockHeight } =
      await conn.getLatestBlockhash({ commitment: 'confirmed' });
  
  try {
    // Try to get an older block if available (45 blocks old)
    const safeStart = lastValidBlockHeight - 105;    // 45-block head-start
    if (safeStart > 0) {
      const oldBlock = await conn.getBlock(safeStart, { commitment: 'confirmed' });
      if (oldBlock && oldBlock.blockhash) {
        console.log(`[DEPLOY] Using older blockhash with ~105 blocks of validity remaining`);
        return { blockhash: oldBlock.blockhash, lastValidBlockHeight };
      }
    }
  } catch (err) {
    console.warn(`[DEPLOY] Could not get older blockhash, using latest: ${err}`);
  }
  
  // Fall back to latest if older block retrieval fails
  return { blockhash, lastValidBlockHeight };
}

/**
 * Options for deploying a program using ephemeral key approach
 */
interface EphemeralDeployOptions {
  soBytes: ArrayBuffer;
  connection: Connection;
  wallet: WalletContextState;
  onProgress?: (progress: number, message: string) => void;
  programId?: PublicKey;
}

/**
 * Result of a deployment operation
 */
interface DeployResult {
  programId: PublicKey;
  signatures: string[];
  success: boolean;
}

/**
 * Deploys a Solana program using an ephemeral key to handle bulk operations
 * while the wallet funds and maintains upgrade authority
 */
export async function deployWithEphemeralKey(
  options: EphemeralDeployOptions
): Promise<DeployResult> {
  const {
    soBytes,
    connection,
    wallet,
    onProgress = () => {},
    programId: userProvidedProgramId,
  } = options;
  
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or doesn't support signing");
  }
  
  // Cache the payer's public key to avoid repeated null checks
  const walletPublicKey = wallet.publicKey;
  const signatures: string[] = [];
  
  // Convert ArrayBuffer to Uint8Array for processing
  const programData = new Uint8Array(soBytes);
  const dataLength = programData.length;
  const bufferSpace = HEADER_LEN + dataLength;
  
  onProgress(0, "Generating ephemeral key...");
  console.log(`[EPHEMERAL_DEPLOY] Starting deployment, program size: ${dataLength} bytes`);
  
  // 1. Generate an ephemeral keypair that only lives in RAM
  const ephemeralKey = Keypair.generate();
  console.log(`[EPHEMERAL_DEPLOY] Ephemeral key generated: ${ephemeralKey.publicKey.toBase58()}`);
  
  // 2. Create a buffer account (using a real keypair, not PDA)
  const bufferKey = Keypair.generate();
  
  // ── Program-id setup ──────────────────────────────────────────
  let programKeypair: Keypair | null = null;
  let programId: PublicKey;

  if (userProvidedProgramId) {
    // caller supplied target id → we will NOT create the account
    programId = userProvidedProgramId;
  } else {
    programKeypair = Keypair.generate();               // new account we will fund
    programId      = programKeypair.publicKey;
  }

  const [programDataPubkey] = PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    BPF_UPGRADE_LOADER_ID,
  );
  
  console.log(`[EPHEMERAL_DEPLOY] Program ID: ${programId.toBase58()}`);
  console.log(`[EPHEMERAL_DEPLOY] Buffer: ${bufferKey.publicKey.toBase58()}`);
  
  // Calculate rent-exempt balances
  const bufferRent = await connection.getMinimumBalanceForRentExemption(bufferSpace);
  const programRent = await connection.getMinimumBalanceForRentExemption(0);
  
  // Calculate SOL needed for ephemeral key to pay for all transactions
  // We need enough for:
  // 1. Rent for buffer account
  // 2. Rent for program account
  // 3. Transaction fees for all write transactions (~175) and deploy transaction
  const writeTxCount = Math.ceil(dataLength / CHUNK_SIZE);
  const feePerTx = 10000; // safer
  const totalFees = (writeTxCount + 2) * feePerTx; // +2 for createBuffer and deploy txs
  const totalNeeded = bufferRent + programRent + totalFees;
  
  onProgress(5, "Funding ephemeral key...");
  
  // 2.1 Create a transaction to fund the ephemeral key
  const fundingTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: ephemeralKey.publicKey,
      lamports: totalNeeded,
    })
  );
  
  // 2.2 Get a fresh blockhash
  const blockHashInfo = await connection.getLatestBlockhash('confirmed');
  const blockhash = blockHashInfo.blockhash;
  const lastValidBlockHeight = blockHashInfo.lastValidBlockHeight;
  
  fundingTx.recentBlockhash = blockhash;
  fundingTx.feePayer = walletPublicKey;
  
  // 2.3 Have the wallet sign the funding transaction
  const signedFundingTx = await wallet.signTransaction(fundingTx);
  
  // 2.4 Send and confirm the funding transaction
  const fundingSig = await connection.sendRawTransaction(signedFundingTx.serialize());
  signatures.push(fundingSig);
  
  // Wait for confirmation
  await connection.confirmTransaction({
    blockhash,
    lastValidBlockHeight,
    signature: fundingSig
  });
  
  console.log(`[EPHEMERAL_DEPLOY] Funded ephemeral key with ${totalNeeded} lamports`);
  
  // 3. Now use the ephemeral key for buffer operations
  
  onProgress(10, "Creating buffer account...");
  
  // 3.1 Create the buffer account
  const createBufferIx = new TransactionInstruction({
    programId: BPF_UPGRADE_LOADER_ID,
    keys: [
      { pubkey: ephemeralKey.publicKey, isSigner: true, isWritable: true },
      { pubkey: bufferKey.publicKey, isSigner: true, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      Buffer.from([0]), // Instruction index for Create
      // Max length (little endian)
      Buffer.from(new Uint32Array([bufferSpace]).buffer),
    ]),
  });
  
  const createBufferTx = new Transaction()
    .add(
      SystemProgram.createAccount({
        fromPubkey: ephemeralKey.publicKey,
        newAccountPubkey: bufferKey.publicKey,
        lamports: bufferRent,
        space: bufferSpace,
        programId: BPF_UPGRADE_LOADER_ID,
      })
    )
    .add(createBufferIx);
  
  const initBufferIx = new TransactionInstruction({
    programId: BPF_UPGRADE_LOADER_ID,
    keys: [
      { pubkey: bufferKey.publicKey,   isSigner: false, isWritable: true },
      { pubkey: ephemeralKey.publicKey,isSigner: true,  isWritable: false },
    ],
    data: Buffer.concat([
      Buffer.from(new Uint32Array([0]).buffer), // tag = InitializeBuffer
      Buffer.from(new Uint32Array([1]).buffer), // COption::Some
      ephemeralKey.publicKey.toBuffer(),        // authority
    ]),
  });
  createBufferTx.add(initBufferIx);
  
  // Get a fresh blockhash for the buffer creation
  const bufferBlockhashInfo = await connection.getLatestBlockhash('confirmed');
  const bufferHash = bufferBlockhashInfo.blockhash;
  const bufferHeight = bufferBlockhashInfo.lastValidBlockHeight;
    
  createBufferTx.recentBlockhash = bufferHash;
  createBufferTx.feePayer = ephemeralKey.publicKey;
  
  // Sign with both the ephemeral key and buffer key
  createBufferTx.sign(ephemeralKey, bufferKey);
  
  // Send and confirm buffer creation
  const bufferSig = await connection.sendRawTransaction(createBufferTx.serialize());
  signatures.push(bufferSig);
  
  await connection.confirmTransaction({
    blockhash: bufferHash,
    lastValidBlockHeight: bufferHeight,
    signature: bufferSig
  });
  
  console.log(`[EPHEMERAL_DEPLOY] Buffer account created`);
  
  // 3.2 Write program data in chunks
  const numChunks = Math.ceil(dataLength / CHUNK_SIZE);
  console.log(`[EPHEMERAL_DEPLOY] Writing program in ${numChunks} chunks`);
  
  const writeSigs: string[] = [];
  let lastSafeHashInfo: { blockhash: string, lastValidBlockHeight: number } | null = null;

  for (let i = 0; i < numChunks; i++) {
    const offset = i * CHUNK_SIZE;
    const end = Math.min(offset + CHUNK_SIZE, dataLength);
    const chunkSize = end - offset;
    const chunk = programData.slice(offset, end);
    
    onProgress(10 + Math.floor((i / numChunks) * 70), 
               `Writing chunk ${i+1}/${numChunks}...`);
    
    const writeIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: bufferKey.publicKey,   isSigner: false, isWritable: true },
        { pubkey: ephemeralKey.publicKey,isSigner: true,  isWritable: false },
      ],
      data: Buffer.concat([
        Buffer.from(new Uint32Array([1]).buffer),        // tag = Write
        Buffer.from(new Uint32Array([offset]).buffer),   // offset
        Buffer.from(BigUint64Array.of(BigInt(chunkSize)).buffer), // length
        Buffer.from(chunk),                              // payload
      ]),
    });
    
    const writeTx = new Transaction().add(writeIx);
    
    // Get a fresh blockhash for each write transaction
    // We can use the safe hash approach to get more validity time
    const safeHashInfo = await getSafeHash(connection);
    
    writeTx.recentBlockhash = safeHashInfo.blockhash;
    writeTx.feePayer = ephemeralKey.publicKey;
    
    // Sign with the ephemeral key
    writeTx.sign(ephemeralKey);
    
    // Send raw transaction without waiting for confirmation
    // We'll send them all quickly
    const writeSig = await connection.sendRawTransaction(writeTx.serialize());
    writeSigs.push(writeSig);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 10));
    
    lastSafeHashInfo = safeHashInfo;
  }
  
  // 3.3 Wait for all write transactions to be confirmed
  onProgress(80, "Verifying all writes...");
  console.log(`[EPHEMERAL_DEPLOY] Waiting for all write transactions to confirm...`);
  
  await connection.confirmTransaction({
    signature: writeSigs[writeSigs.length - 1],
    blockhash: lastSafeHashInfo!.blockhash,
    lastValidBlockHeight: lastSafeHashInfo!.lastValidBlockHeight,
  });
  const statuses = await connection.getSignatureStatuses(writeSigs);
  statuses.value.forEach((st, i) => {
    if (st && st.err) throw new Error(`Write TX #${i} failed: ${JSON.stringify(st.err)}`);
  });
  
  // 4. Deploy the program using the buffer
  onProgress(85, "Deploying program...");
  console.log(`[EPHEMERAL_DEPLOY] Deploying program from buffer...`);
  
  // 4.1 Create program account transaction
  const createProgramAcct = SystemProgram.createAccount({
    fromPubkey: ephemeralKey.publicKey,
    newAccountPubkey: programKeypair?.publicKey || programId,
    lamports: programRent,
    space: 0,
    programId: BPF_UPGRADE_LOADER_ID,
  });
  
  // 4.2 Deploy instruction
  const deployIx = new TransactionInstruction({
    programId: BPF_UPGRADE_LOADER_ID,
    keys: [
      { pubkey: walletPublicKey,        isSigner: true,  isWritable: true },  // payer + upgrade authority
      { pubkey: programDataPubkey,      isSigner: false, isWritable: true },
      { pubkey: programId,              isSigner: !!programKeypair, isWritable: true },
      { pubkey: bufferKey.publicKey,    isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY,     isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY,    isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,isSigner: false, isWritable: false },
      { pubkey: walletPublicKey,        isSigner: true,  isWritable: false }, // duplicate for authority (spec)
    ],
    data: Buffer.concat([
      Buffer.from([2]), // Instruction index for DeployWithMaxDataLen
      // Max data len (little endian)
      Buffer.from(new Uint32Array([bufferSpace]).buffer),
    ]),
  });
  
  const deployTx = new Transaction()
    .add(createProgramAcct)
    .add(deployIx);
  
  // Get fresh blockhash for deploy transaction
  const deployBlockhashInfo = await connection.getLatestBlockhash('confirmed');
  const deployHash = deployBlockhashInfo.blockhash;
  const deployHeight = deployBlockhashInfo.lastValidBlockHeight;
    
  deployTx.recentBlockhash = deployHash;
  deployTx.feePayer = ephemeralKey.publicKey;
  
  // Sign with both the ephemeral key and program key
  deployTx.sign(ephemeralKey, ...(programKeypair ? [programKeypair] : []));
  
  // Send and confirm deployment
  const deploySig = await connection.sendRawTransaction(deployTx.serialize());
  signatures.push(deploySig);
  
  await connection.confirmTransaction({
    blockhash: deployHash,
    lastValidBlockHeight: deployHeight,
    signature: deploySig
  });
  
  const revertIx = new TransactionInstruction({
    programId: BPF_UPGRADE_LOADER_ID,
    keys: [
      { pubkey: bufferKey.publicKey,    isSigner: false, isWritable: true },
      { pubkey: walletPublicKey,        isSigner: true,  isWritable: false },
      { pubkey: walletPublicKey,        isSigner: false, isWritable: false },
    ],
    data: Buffer.from(new Uint32Array([4]).buffer),  // tag = SetAuthority, new=wallet
  });
  const revertTx = new Transaction().add(revertIx);
  revertTx.feePayer = walletPublicKey;
  revertTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const revertSig = await wallet.sendTransaction(revertTx, connection);
  signatures.push(revertSig);
  await connection.confirmTransaction(revertSig, 'confirmed');
  
  console.log(`[EPHEMERAL_DEPLOY] Program deployed successfully to ${programId.toBase58()}`);
  onProgress(100, "Deployment successful!");
  
  return {
    programId,
    signatures,
    success: true
  };
} 