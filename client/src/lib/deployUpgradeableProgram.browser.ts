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
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { connection as devnetConnection } from "@/utils/connection";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { throttle } from "@/utils/rateLimiter";
import { 
  BPF_UPGRADE_LOADER_ID,
  BPF_BUFFER_HEADER_LEN 
} from "@/utils/constants";
import type { SendOptions } from '@solana/web3.js';

// ── Throttle settings ──────────────────────────────────────────────
// Defaults replicate SolPG's public-cluster pacing ≈ 4 TX/s.
// Override in .env (e.g. NEXT_PUBLIC_TX_BURST_SIZE=5 NEXT_PUBLIC_TX_BURST_WAIT=100
// when you move to QuickNode Build).
//const BURST_SIZE = Number(process.env.NEXT_PUBLIC_TX_BURST_SIZE ?? 1);
//const BURST_WAIT = Number(process.env.NEXT_PUBLIC_TX_BURST_WAIT ?? 350); // ms
const BURST_SIZE = 1;
const BURST_WAIT = 400; // ms


// Helper function for little-endian u32 encoding
function leU32(n: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n, 0);
  return buf;
}

// Helper for little-endian u64 encoding
function leU64(n: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n), 0);
  return buf;
}

// Shared chunk size across upload logic
// 850 B payload keeps write-tx ≈1 212 B, safely <1 232-byte limit
export const MAX_CHUNK_SIZE = 900;
export const HEADER_LEN = BPF_BUFFER_HEADER_LEN;

// ── Funding for the in-browser buffer authority ───────────────────────────
// 0.02 SOL covers ≈300–400 Write TXs with plenty of head-room.
const AUTHORITY_FUND_LAMPORTS = Math.round(0.02 * LAMPORTS_PER_SOL);

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
 * Returns a blockhash that is ~SAFE_OFFSET slots old,
 * so you have extra runway after signing.
 */
// Less runway now that signing is quick
const SAFE_OFFSET = 0;    // use the freshest block-hash
async function getSafeBlockhash(conn: Connection) {
  const latest = await conn.getLatestBlockhash('confirmed');
  const currentSlot = await conn.getSlot('confirmed');
  const targetSlot = Math.max(0, currentSlot - SAFE_OFFSET);

  // query that older slot; fall back to latest if rpc/node can't serve it
  try {
    const oldBlock = await conn.getBlock(targetSlot, { commitment: 'confirmed' });
    if (oldBlock?.blockhash) {
      return { 
        blockhash: oldBlock.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight
      };
    }
  } catch (_) { /* ignore – rare on Devnet */ }

  return latest;  // use the fresh one if lookup fails
}

// Helper function for confirming transactions with proper blockhash tracking
async function confirmWithBlockhash(
  conn: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
) {
  const res = await conn.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );
  if (res.value.err) throw new Error(JSON.stringify(res.value.err));
}

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
  console.log(`[DEPLOY] Throttle: ${BURST_SIZE} tx every ${BURST_WAIT} ms`);
  
  // 1. Create a *real* buffer account (Keypair, not PDA)
  const bufferKey = Keypair.generate();
  
  // 👉 NEW: short-lived key that will be the buffer authority
  const bufferAuthority = Keypair.generate();
  
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
    // 2. (a) Fund the bufferAuthority and allocate the buffer account
    const fundAuthorityIx = SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: bufferAuthority.publicKey,
      lamports: AUTHORITY_FUND_LAMPORTS,
    });

    // (b) Allocate the buffer with SystemProgram
    const createBufAcct = SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: bufferKey.publicKey,
      lamports,
      space: bufferSpace,
      programId: BPF_UPGRADE_LOADER_ID,
    });

    // 2. (c) Initialise the buffer: proper bincode serialization with tag and COption
    const initBufIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: bufferKey.publicKey,   isSigner: false, isWritable: true },
        { pubkey: bufferAuthority.publicKey, isSigner: true,  isWritable: false },
      ],
      // tag = 0  |  COption::Some (u32 = 1)  |  <32-byte authority pubkey>
      data: Buffer.concat([
        leU32(0),                // InitializeBuffer
        leU32(1),                // COption::Some
        bufferAuthority.publicKey.toBuffer(),
      ]),
    });
    
    onProgress?.({ stage: 'create', uploaded: 0, total: dataLength });

    // No priority fee needed for buffer creation, only for deploy
    const createBufferTx = new Transaction()
      .add(fundAuthorityIx) // top-up bufferAuthority
      .add(createBufAcct)   // create buffer account
      .add(initBufIx);      // initialise buffer, authority = bufferAuthority
    
    createBufferTx.feePayer = payer;
    
    // 👉 DO NOT send or confirm yet – just queue it
    const writeTxs: Transaction[] = [createBufferTx];  // start with buffer creation as first tx
    
    // 3. Write program data in chunks
    const numChunks = Math.ceil(dataLength / MAX_CHUNK_SIZE);
    console.log(`[DEPLOY] Writing program data in ${numChunks} chunks of max ${MAX_CHUNK_SIZE} bytes each`);
    
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
          { pubkey: bufferKey.publicKey,      isSigner: false, isWritable: true },
          { pubkey: bufferAuthority.publicKey, isSigner: true,  isWritable: false },
        ],
        data: Buffer.concat([
          leU32(1),                         // tag = Write
          leU32(offset),                    // offset
          Buffer.from(chunk),               // raw bytes
        ]),
      });
      
      // Fee-payer = bufferAuthority, so wallet never signs these writes
      const writeTx = new Transaction().add(writeIx);
      writeTx.feePayer = bufferAuthority.publicKey;
      writeTxs.push(writeTx);
      
      // Don't yield during chunking (match Playground behavior)
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
        leU64(bufferSpace),             // max_data_len (u64)
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
    
    // Priority fee – env-driven, default 60 000 µ◎ like SolPG
    const CU_PRICE = Number(process.env.NEXT_PUBLIC_SOL_PRIORITY_FEE ?? 60_000);
    const deployPriorityIx =
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: CU_PRICE });
    deployTx.instructions.unshift(deployPriorityIx);   // prepend
    
    deployTx.feePayer = payer;
    
    writeTxs.push(deployTx);   // after the loop, before signAllTransactions
    
    // groups[0] = createBufferTx + ALL writes, groups[1] = deployTx
    const groups: Transaction[][] = [];
    
    // First group is just the createBufferTx (includes funding the bufferAuthority)
    groups.push([createBufferTx]);
    
    // --- split all write-TXs into ≤25-TX chunks ---------------------------
    const WRITE_BATCH = 25;            // ~10 s at current throttle
    for (let i = 1; i < writeTxs.length - 1; i += WRITE_BATCH) {
      groups.push(writeTxs.slice(i, Math.min(i + WRITE_BATCH, writeTxs.length - 1)));
    }
    
    // Last group is just the deployTx
    groups.push([writeTxs[writeTxs.length - 1]]);

    // Helper to send and confirm transactions for a group
    async function sendAndConfirm(group: Transaction[], blockhash: string, lastValidBlockHeight: number) {
      // sign buffer-creation tx only now that it has a blockhash
      group.find(tx => tx === createBufferTx)?.partialSign(bufferKey);
      
      // every tx also needs the buffer authority signature
      group.forEach(tx => tx.partialSign(bufferAuthority));
      
      // Partial sign with program keypair if needed
      if (programKeypair) group.find(tx => tx === deployTx)?.partialSign(programKeypair);

      /* ── NEW: ask Phantom to sign **only** the TXs that include `payer` ── */
      const needsWallet = group.filter(tx =>
        tx.signatures.some(sig => sig.publicKey.equals(payer))
      );

      let signed: Transaction[];
      if (needsWallet.length) {
        if (!wallet.signAllTransactions) {
          throw new Error("Wallet doesn't support signing multiple transactions");
        }
        const signedSubset = await wallet.signAllTransactions(needsWallet);
        // merge back while preserving original order
        let i = 0;
        signed = group.map(tx => (needsWallet.includes(tx) ? signedSubset[i++] : tx));
      } else {
        // no wallet signature needed for this group
        signed = group;
      }
      
      console.log(`[DEPLOY] Batch signed (${signed.length} TX)`);

      // Fire signed TX quickly, but throttle in small bursts
      const sigs: string[] = [];
      for (let i = 0; i < signed.length; i++) {
        if (i !== 0 && i % BURST_SIZE === 0) await throttle(BURST_WAIT);
        sigs.push(await connection.sendRawTransaction(signed[i].serialize(), SEND_OPTS));
      }

      // Confirm only the LAST signature of this group using long-form confirmation
      await confirmWithBlockhash(
        connection,
        sigs.at(-1)!,
        blockhash,
        lastValidBlockHeight
      );

      // Verify every status
      const st = await connection.getSignatureStatuses(sigs);
      st.value.forEach((v, ix) => { if (v?.err) throw new Error(`TX ${ix} failed: ${JSON.stringify(v.err)}`); });
      
      return sigs;
    }

    for (const [gIdx, group] of groups.entries()) {
      try {
        // Fetch a safer blockhash (≈100 slots old) for this batch
        const { blockhash, lastValidBlockHeight } = await getSafeBlockhash(connection);
        group.forEach(tx => { tx.recentBlockhash = blockhash; });
        
        const sigs = await sendAndConfirm(group, blockhash, lastValidBlockHeight);
        signatures.push(...sigs);
        
        // Log buffer creation success if this was the first group
        if (gIdx === 0) {
          console.log(`[DEPLOY] Buffer created successfully. Signature: ${sigs[0]}`);
        }
      } catch (e: any) {
        // Handle AccountDataTooSmall error for program upgrades
        if (userProvidedProgramId && /AccountDataTooSmall/.test(e.message)) {
          console.warn("[DEPLOY] Program data too small – extending and retrying");

          // Bump max_data_len by 10%
          const newMax = bufferSpace + Math.ceil(bufferSpace * 0.10);

          const extendIx = new TransactionInstruction({
            programId: BPF_UPGRADE_LOADER_ID,
            keys: [
              { pubkey: programDataPubkey, isSigner: false, isWritable: true },
              { pubkey: payer,            isSigner: true,  isWritable: true },
            ],
            data: Buffer.concat([
              leU32(5),                      // 5 = ExtendProgram
              leU64(newMax),                 // new max_data_len (u64)
            ]),
          });

          const extendTx = new Transaction().add(extendIx);
          extendTx.feePayer = payer;
          
          const { blockhash, lastValidBlockHeight } = await getSafeBlockhash(connection);
          extendTx.recentBlockhash = blockhash;

          const signed = await wallet.signTransaction(extendTx);
          const sig = await connection.sendRawTransaction(signed.serialize(), SEND_OPTS);
          await confirmWithBlockhash(
            connection,
            sig,
            blockhash,
            lastValidBlockHeight
          );

          console.log(`[DEPLOY] Program extended successfully. Signature: ${sig}`);
          
          // Now re-run the original upgrade logic
          return await deployUpgradeableProgram(options);
        }
        
        // Re-throw other errors
        throw e;
      }
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