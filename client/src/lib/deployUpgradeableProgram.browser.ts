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
  ComputeBudgetProgram,
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
import type { SendOptions } from '@solana/web3.js';

// Helper function for little-endian u32 encoding
function leU32(n: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n, 0);
  return buf;
}

// Helper for little-endian u64
function leU64(n: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(n, 0);
  return buf;
}

// Shared chunk size across upload logic
export const MAX_CHUNK_SIZE = BPF_LOADER_CHUNK_SIZE;
export const HEADER_LEN = BPF_BUFFER_HEADER_LEN;

// Bypass RPC simulation for all non-funding TXs;
// retries help if the TPU drops a packet in browser env.
const SEND_OPTS: SendOptions = { skipPreflight: true, maxRetries: 5 };

// Phantom (current versions) cap signAllTransactions at ~100 TXs; stay well below.
const MAX_BATCH = 12;  // 12 tx burst; now ~1 s with 80 ms throttle
// Phantom UI stays reliable below 100 tx; use a safe margin.
const PROMPT_GROUP_SIZE = MAX_BATCH;   // 12 tx per wallet popup

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
  
  // Generate a keypair only when we are _creating_ a new program
  const programKeypair: Keypair | null = userProvidedProgramId ? null : Keypair.generate();
  
  const effectiveProgramId = userProvidedProgramId ?? programKeypair!.publicKey;
  
  const [programDataPubkey] = PublicKey.findProgramAddressSync(
    [effectiveProgramId.toBuffer()],
    BPF_UPGRADE_LOADER_ID,
  );
  
  // Rent-exempt lamports for the buffer's exact length
  const lamports = await connection.getMinimumBalanceForRentExemption(bufferSpace);
  const progLamports = programKeypair
    ? await connection.getMinimumBalanceForRentExemption(0)
    : 0;
  
  console.log(`[DEPLOY] Buffer: ${bufferKey.publicKey.toBase58()}`);
  console.log(`[DEPLOY] Program ID: ${effectiveProgramId.toBase58()}`);
  
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
    
    onProgress?.({ stage: 'create', uploaded: 0, total: dataLength });

    const priorityIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 60_000,          // ≈0.00006 SOL
    });
    const createBufferTx = new Transaction()
      .add(priorityIx)                // must be first
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
      SEND_OPTS
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
    const numChunks = Math.ceil(dataLength / MAX_CHUNK_SIZE);
    console.log(`[DEPLOY] Writing program data in ${numChunks} chunks of max ${MAX_CHUNK_SIZE} bytes each`);
    
    // Prepare an array to collect chunk uploads
    const writeTxs: Transaction[] = [];
    
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      // offset is from start of the payload area (after the 48-byte ProgramData header)
      const offset = chunkIndex * MAX_CHUNK_SIZE;
      const chunkEnd = Math.min((chunkIndex + 1) * MAX_CHUNK_SIZE, dataLength);
      const chunkSize = chunkEnd - chunkIndex * MAX_CHUNK_SIZE;
      const chunk = programData.slice(chunkIndex * MAX_CHUNK_SIZE, chunkEnd);
      
      onProgress?.({
        stage: 'write',
        uploaded: chunkIndex * MAX_CHUNK_SIZE,
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
          leU64(BigInt(chunkSize)),         // Vec<u8> length prefix
          Buffer.from(chunk),               // raw bytes
        ]),
      });
      
      const priorityIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 60_000 });
      const writeTx = new Transaction()
        .add(priorityIx)
        .add(writeIx);
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
        { pubkey: effectiveProgramId,       isSigner: !!programKeypair, isWritable: true },
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
    
    let deployTx = new Transaction();
    
    if (programKeypair) {
      const createProgAcct = SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: programKeypair.publicKey,
        lamports: progLamports,
        space: 0,
        programId: BPF_UPGRADE_LOADER_ID,
      });
      deployTx = deployTx.add(createProgAcct);
    }
    deployTx = deployTx.add(deployIx);
    
    const deployPriorityIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 60_000 });
    deployTx.instructions.unshift(deployPriorityIx);   // prepend
    
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
      const { value: { blockhash: grpHash, lastValidBlockHeight: lvh } } =
        await rpcWithRetry<{ value: { blockhash: string; lastValidBlockHeight: number } }>(
          connection, "getLatestBlockhash", [{ commitment: "confirmed" }], "confirmed");

      for (const tx of group) {
        tx.recentBlockhash = grpHash;
        if (programKeypair && tx === deployTx) tx.partialSign(programKeypair);          // keep partial-sign
      }

      // ── 3. ONE wallet prompt here ────────────────────────────────────────────
      const signedGroup = await wallet.signAllTransactions(group);
      console.log(`[DEPLOY] Sending group ${batchIndex + 1}/${groups.length} (${signedGroup.length} txs signed, ${Math.ceil(signedGroup.length / MAX_BATCH)} bursts)`);
      batchIndex++;

      // small delay so the hash propagates to "confirmed"
      await yieldToBrowser(50);

      // ── 4. fire the signed txs in 12-tx network bursts ──────────────────────
      for (let i = 0; i < signedGroup.length; i += MAX_BATCH) {
        const burstIndex = Math.floor(i / MAX_BATCH) + 1;
        const totalBursts = Math.ceil(signedGroup.length / MAX_BATCH);
        console.log(`[DEPLOY] Processing burst ${burstIndex}/${totalBursts} in group ${batchIndex}/${groups.length}`);
        
        const burst = signedGroup.slice(i, i + MAX_BATCH);

        /* send every tx in the group, remember sigs */
        const sigs: string[] = [];
        for (const tx of burst) {
          await throttle(40);                   // faster throttle
          sigs.push(await connection.sendRawTransaction(tx.serialize(), SEND_OPTS));
        }
        /* once every tx is in the TPU, confirm the last one;
           if it is rooted, the earlier sigs are rooted too */
        await connection.confirmTransaction(
          { signature: sigs[sigs.length - 1], blockhash: grpHash, lastValidBlockHeight: lvh },
          'confirmed'
        );
        /* extra safety: poll all sigs for errors */
        const status = await connection.getSignatureStatuses(sigs);
        status.value.forEach((st, idx) => {
          if (st && st.err) throw new Error(`TX ${idx} failed: ${JSON.stringify(st.err)}`);
        });
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
    
    console.log(`[DEPLOY] Program deployed successfully with ID: ${effectiveProgramId.toBase58()}`);
    
    onProgress?.({
      stage: 'complete',
      uploaded: dataLength,
      total: dataLength
    });
    
    return {
      programId: effectiveProgramId,
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