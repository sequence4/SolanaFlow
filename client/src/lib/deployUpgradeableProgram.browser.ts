/**
 * BROWSER-side deployer (uses WalletAdapter + signAllTransactions).
 * Server-side deployer lives in "@/utils/project/deployUpgradableProgram.server".
 */
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
import { connection as devnetConnection, RATE_LIMIT_MS } from "@/utils/connection";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { rpcWithRetry } from "@/utils/rpcRetry";
import { throttle } from "@/utils/rateLimiter";
import { 
  BPF_LOADER_CHUNK_SIZE, 
  BPF_UPGRADE_LOADER_ID,
  BPF_BUFFER_HEADER_LEN 
} from "@/utils/constants";

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

const CHUNK_SIZE = BPF_LOADER_CHUNK_SIZE;
const HEADER_LEN = BPF_BUFFER_HEADER_LEN;
// Phantom (current versions) cap signAllTransactions at ~100 TXs; stay well below.
const MAX_BATCH = 12;  // 12×900 B ≃ 10 KB – sim & preflight finish < 20 s
// Phantom UI stays reliable below 100 tx; use a safe margin.
const PROMPT_GROUP_SIZE = 90;          // one Phantom pop-up handles ≤ 90 tx

type DeployProgress = {
  stage: 'create' | 'write' | 'deploy' | 'complete';
  uploaded: number;
  total: number;
  chunkIndex?: number;
  totalChunks?: number;
};

type DeployOptions = {
  soBytes: ArrayBuffer;
  /** optional – defaults to shared dev-net connection */
  connection?: Connection;
  wallet: WalletContextState;
  programId?: PublicKey;
  onProgress?: (progress: DeployProgress) => void;
  /** Use an older blockhash for extremely slow networks (gives ~105 blocks validity) */
  useSafeHash?: boolean;
};

type DeployResult = {
  programId: PublicKey;
  signatures: string[];
};

/**
 * Yields to the browser's event loop, allowing UI updates
 * @param ms Optional timeout in milliseconds (defaults to requestAnimationFrame timing ~16ms)
 */
async function yieldToBrowser(ms?: number): Promise<void> {
  if (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

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
 * Deploys a Solana program using the BPF Upgradeable Loader
 * This function implements the full deployment flow:
 * 1. Create buffer account
 * 2. Write program data in chunks
 * 3. Deploy program from buffer
 */
export async function deployUpgradeableProgram(
  options: DeployOptions,
): Promise<DeployResult> {
  // fall back to the shared Helius connection if caller omitted one
  const {
    soBytes,
    connection = devnetConnection,
    wallet,
    onProgress,
    programId: userProvidedProgramId,
    useSafeHash,
  } = options;
  
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or doesn't support signing");
  }
  
  // Cache the payer's public key to avoid repeated null checks
  const payer = wallet.publicKey;
  
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
      fromPubkey: payer,
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
        { pubkey: payer,  isSigner: true,  isWritable: false },
      ],
      data: Buffer.concat([
        leU32(0),                     // tag = InitializeBuffer
        leU32(1),                     // COption::Some discriminant
        payer.toBuffer(), // 32-byte authority pubkey
      ]),
    });
    
    const createProgAcct = SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: programKey.publicKey,
      lamports: progLamports,
      space: 0,                       // program acct stores only a pointer
      programId: BPF_UPGRADE_LOADER_ID,
    });

    onProgress?.({ stage: 'create', uploaded: 0, total: dataLength });

    const createBufferTx = new Transaction()
      .add(createBufAcct)   // create account
      .add(initBufIx);      // initialise buffer, authority = wallet
    
    createBufferTx.feePayer = payer;
    const { value: { blockhash, lastValidBlockHeight: lvh } } =
      await rpcWithRetry<{ value: { blockhash: string; lastValidBlockHeight: number } }>(connection, "getLatestBlockhash",
        [{ commitment: "confirmed" }], "confirmed");
    createBufferTx.recentBlockhash = blockhash;
    
    // Sign with wallet + bufferKey
    createBufferTx.partialSign(bufferKey);
    const signedCreateBufferTx = await wallet.signTransaction(createBufferTx);
    const createBufferSig = await connection.sendRawTransaction(
      signedCreateBufferTx.serialize(),
      {
        skipPreflight: false,
        /** MUST match the commitment used for getLatestBlockhash */
        preflightCommitment: 'confirmed',
      }
    );
    signatures.push(createBufferSig);
    
    // Wait for confirmation with full form
    await connection.confirmTransaction(
      { 
        signature: createBufferSig, 
        blockhash, 
        lastValidBlockHeight: lvh 
      },
      'confirmed'  // match the commitment used for the hash
    );
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
          { pubkey: payer,   isSigner: true,  isWritable: false },
        ],
        data: Buffer.concat([
          leU32(1),                         // tag = Write
          leU32(offset),                    // offset
          leU64(BigInt(chunk.length)),      // bytes.len() as u64
          Buffer.from(chunk),               // raw bytes
        ]),
      });
      
      const writeTx = new Transaction().add(writeIx);
      writeTx.feePayer = payer;
      writeTxs.push(writeTx);
      
      if (chunkIndex % 20 === 0) {
        // give the event-loop 1 ms - less frequent for better performance on large binaries
        await yieldToBrowser(1);
      }
    }
    
    const deployIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: payer,        isSigner: true,  isWritable: true },
        { pubkey: programDataPubkey,        isSigner: false, isWritable: true },
        { pubkey: programKey.publicKey,     isSigner: true,  isWritable: true },
        { pubkey: bufferKey.publicKey,      isSigner: false, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY,       isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY,      isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
        { pubkey: payer,        isSigner: true,  isWritable: false },
      ],
      data: Buffer.concat([
        leU32(2),                       // Loader instruction tag 2 = DeployWithMaxDataLen
        Buffer.from(new Uint32Array([bufferSpace]).buffer),
      ]),
    });
    
    const deployTx = new Transaction()
      .add(createProgAcct)   // program account
      .add(deployIx);
    
    deployTx.feePayer = payer;
    
    writeTxs.push(deployTx);   // after the loop, before signAllTransactions
    
    // ── sign & send in safe-sized batches ──────────────────────────────────────────
    if (!wallet.signAllTransactions) {
      throw new Error("Wallet doesn't support signing multiple transactions");
    }

    // ── 1. slice all prepared txs into "signature groups" of ≤ 90 ──────────────
    const groups: Transaction[][] = [];
    for (let i = 0; i < writeTxs.length; i += PROMPT_GROUP_SIZE) {
      groups.push(writeTxs.slice(i, i + PROMPT_GROUP_SIZE));
    }

    let batchIndex = 0;
    for (const group of groups) {
      // ── 2. attach ONE fresh hash to the whole group ──────────────────────────
      let grpHash: string;
      let lvh: number;

      if (useSafeHash) {
        // Use a hash that's already ~45 blocks old for extra validity time
        const safeHashInfo = await getSafeHash(connection);
        grpHash = safeHashInfo.blockhash;
        lvh = safeHashInfo.lastValidBlockHeight;
      } else {
        // Use the latest hash with standard validity
        const { value: { blockhash, lastValidBlockHeight } } =
          await rpcWithRetry<{ value: { blockhash: string; lastValidBlockHeight: number } }>(
            connection, "getLatestBlockhash", [{ commitment: "confirmed" }], "confirmed");
        grpHash = blockhash;
        lvh = lastValidBlockHeight;
      }

      for (const tx of group) {
        tx.recentBlockhash = grpHash;
        if (tx === deployTx) tx.partialSign(programKey);          // keep partial-sign
      }

      // ── 3. ONE wallet prompt here ────────────────────────────────────────────
      const signedGroup = await wallet.signAllTransactions(group);
      console.log(`[DEPLOY] Sending group ${batchIndex + 1}/${groups.length} (${signedGroup.length} txs signed, ${Math.ceil(signedGroup.length / MAX_BATCH)} bursts)`);
      batchIndex++;

      // small delay so the hash propagates to "confirmed"
      await yieldToBrowser(300);

      // ── 4. fire the signed txs in 12-tx network bursts ──────────────────────
      for (let i = 0; i < signedGroup.length; i += MAX_BATCH) {
        const burstIndex = Math.floor(i / MAX_BATCH) + 1;
        const totalBursts = Math.ceil(signedGroup.length / MAX_BATCH);
        console.log(`[DEPLOY] Processing burst ${burstIndex}/${totalBursts} in group ${batchIndex}/${groups.length}`);
        
        const burst = signedGroup.slice(i, i + MAX_BATCH);

        // 1️⃣ fire them all asap ----------------------------------------------
        const sigs: string[] = [];
        const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        
        // Sequential send with throttling to respect rate limits
        const sendOpts = { skipPreflight: false, preflightCommitment: 'confirmed' as const };
        for (const tx of burst) {
          await throttle();  // 220 ms guard, called sequentially
          const sig = await connection.sendRawTransaction(tx.serialize(), sendOpts);
          sigs.push(sig);
        }

        // 2️⃣ confirm the whole burst in parallel ------------------------------
        await connection.confirmTransaction(
          { signature: sigs[sigs.length - 1], blockhash: grpHash, lastValidBlockHeight: lvh },
          'confirmed'
        );
        
        // Verify all signatures were successful, not just the last one
        const statusResp = await connection.getSignatureStatuses(sigs);
        statusResp.value.forEach((st, idx) => {
          if (st && st.err) throw new Error(`TX ${i + idx} failed: ${JSON.stringify(st.err)}`);
        });
        
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const elapsedTime = ((now - startTime) / 1000).toFixed(1);
        console.log(`[DEPLOY] Burst ${burstIndex}/${totalBursts} confirmed in ${elapsedTime} s`);
        
        // the other 11 sigs will be at the same or later slot, so they're auto-confirmed
        signatures.push(...sigs);
      }
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