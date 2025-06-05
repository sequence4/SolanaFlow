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

// --- grouping & timing ---------------------------------------------------
const GROUP_SIZE = 25;    // max legacy-TX per wallet popup
const BURST_SIZE = 8;     // how many TX we fire before a tiny delay
const BURST_WAIT = 40;    // ms – keeps us < 5 TPS (Helius soft limit)

// Helper function for little-endian u32 encoding
function leU32(n: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n, 0);
  return buf;
}

// Shared chunk size across upload logic
export const MAX_CHUNK_SIZE = BPF_LOADER_CHUNK_SIZE;
export const HEADER_LEN = BPF_BUFFER_HEADER_LEN;

// Bypass RPC simulation for all non-funding TXs;
// retries help if the TPU drops a packet in browser env.
const SEND_OPTS: SendOptions = { skipPreflight: true, maxRetries: 5 };

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
      
      // Loader instruction tag 1 = Write (offset + raw bytes)
      const writeIx = new TransactionInstruction({
        programId: BPF_UPGRADE_LOADER_ID,
        keys: [
          { pubkey: bufferKey.publicKey, isSigner: false, isWritable: true },
          { pubkey: payer,   isSigner: true,  isWritable: false },
        ],
        data: Buffer.concat([
          leU32(1),                         // tag = Write
          leU32(offset),                    // offset
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

    // ⬇ BEFORE sending batches (FUTURE OPTION - DURABLE NONCE):
    // import { NONCE_ACCOUNT_LENGTH } from '@solana/web3.js';
    //
    // ...create + fund nonce account once:
    // const nonceKey = Keypair.generate();
    // const createNonceIx = SystemProgram.createNonceAccount({
    //   fromPubkey: payer,
    //   noncePubkey: nonceKey.publicKey,
    //   authorizedPubkey: payer,
    //   lamports: await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH),
    // });
    //   + SystemProgram.nonceAdvance({ noncePubkey: nonceKey.publicKey, authorizedPubkey: payer });
    //
    // For *every* TX: tx.nonceInfo = { nonce: nonceAccount.nonce, nonceInstruction };
    // First instruction in each tx must be SystemProgram.nonceAdvance(...);
    //
    // ==> user signs one extra popup the first time, none for subsequent upgrades.

    // ── slice all prepared TX into groups of ≤ GROUP_SIZE ────────────────
    const groups: Transaction[][] = [];
    for (let i = 0; i < writeTxs.length; i += GROUP_SIZE) {
      groups.push(writeTxs.slice(i, i + GROUP_SIZE));
    }

    for (const [gIdx, group] of groups.entries()) {
      // 1️⃣ fresh hash *before* signing this batch
      const { blockhash: grpHash, lastValidBlockHeight: lvh } =
        await connection.getLatestBlockhash('confirmed');

      group.forEach(tx => { tx.recentBlockhash = grpHash; });
      if (programKeypair) group.find(tx => tx === deployTx)?.partialSign(programKeypair);

      // 2️⃣ one wallet prompt for this batch
      const signed = await wallet.signAllTransactions(group);
      console.log(`[DEPLOY] Batch ${gIdx + 1}/${groups.length} signed (${signed.length} TX)`);

      // 3️⃣ fire signed TX quickly, but throttle in small bursts
      const sigs: string[] = [];
      for (let i = 0; i < signed.length; i++) {
        if (i % BURST_SIZE === 0) await throttle(BURST_WAIT);
        sigs.push(await connection.sendRawTransaction(signed[i].serialize(), SEND_OPTS));
      }

      // 4️⃣ confirm last sig; others are in the same / later slot
      await connection.confirmTransaction({ signature: sigs.at(-1)!, blockhash: grpHash, lastValidBlockHeight: lvh }, 'confirmed');

      // 5️⃣ verify every status
      const st = await connection.getSignatureStatuses(sigs);
      st.value.forEach((v, ix) => { if (v?.err) throw new Error(`TX ${ix} failed: ${JSON.stringify(v.err)}`); });

      signatures.push(...sigs);
    }
    
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