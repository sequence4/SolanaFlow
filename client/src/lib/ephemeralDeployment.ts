import type { SendOptions } from '@solana/web3.js';
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
import { RATE_LIMIT_MS } from '@/utils/connection';
import { createHash } from 'crypto';

/** Little-endian helpers required by the loader */
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

// Buffer header = 4-byte state enum + 1-byte COption + 32-byte authority = 37 bytes
const HEADER_LEN = 37;

// ProgramData account layout constants
const PROGRAMDATA_HEADER = 45; /* 4(tag)+8(slot)+1(opt)+32(key) */
// 4-byte tag + 8-byte slot + 1-byte COption = 13
const PROGRAMDATA_AUTHORITY_OFFSET = 13;

// Define instruction variants as enum - matches on-chain order
enum LoaderIx {
  InitializeBuffer = 0,
  Write = 1, 
  DeployWithMaxDataLen = 2,
  Upgrade = 3,
  SetAuthority = 4
}

// Chunk size for buffer writes (a bit smaller than max to allow for instruction overhead)
const CHUNK_SIZE = 880;
const SAFE_HASH_REFRESH_INTERVAL = 32;   // refresh every N chunks

/**
 * Size of a Program account = UpgradeableLoaderState::program_len()
 * See upstream loader source – constant is 36 bytes.
 */
const PROGRAM_ACCOUNT_SPACE = 36;

// Re-use these options for every raw TX that the wallet does **not** sign.
// Skipping pre-flight avoids "Blockhash not found" simulations.
export const SEND_NO_PREFLIGHT: SendOptions = { skipPreflight: true };
export const SEND_WITH_PREFLIGHT: SendOptions = { skipPreflight: false };

const ONE_LAMPORT = BigInt(1);            // type anchor

/**
 * Gets a blockhash that's already 45 blocks old, giving you ~105 blocks of validity
 * Only use this in very slow networks or when you need extra buffer time
 */
async function getSafeHash(conn: Connection): Promise<{ blockhash: string, lastValidBlockHeight: number }> {
  const latest = await conn.getLatestBlockhash('confirmed');
  const slot   = await conn.getSlot('confirmed');

  // Refresh only if the last-valid window is already <105 slots
  if (latest.lastValidBlockHeight - slot <= 105) {
    return latest;
  }
  // otherwise keep using current hash
  return latest;
}

/**
 * Options for deploying a program using ephemeral key approach
 */
export interface EphemeralDeployOptions {
  soBytes: ArrayBuffer;
  connection: Connection;
  wallet: WalletContextState;           // fee-payer (Phantom)
  /** The **already-generated** Keypair that must become program upgrade authority (ephemeral buffer key) */
  ephemeralKeypair: Keypair;
  /** Optionally, a deterministic program Keypair (to reuse a known program ID).  
   *  _Do not_ pass this from the browser when you want the backend to hold the key. */
  programKeypair?: Keypair;
  /** progress ∈ [0-100], plus human log line */
  onProgress?: (progress: number, message: string) => void;
  /** If provided instead of programKeypair:
   *    • an existing program to *upgrade*, **or**  
   *    • the fresh program‑id emitted by the backend when relayToBackend =true */
  programId?: PublicKey;
  /** If true, return a partially signed deploy TX for backend signing and broadcasting. */
  relayToBackend?: boolean;
  /** Max milliseconds to wait for on-chain authority transfer (default 60_000) */
  verifyTimeoutMs?: number;
  /** Project ID for API calls */
  projectId?: string;
}

/**
 * Result of a deployment operation
 */
interface DeployResult {
  programId: PublicKey;
  signatures: string[];
  success: boolean;
  warning?: string;
  /** base64-encoded DeployWithMaxDataLen transaction when relayToBackend is true */
  encodedTx?: string;
  /** set when relayToBackend is true to indicate the deploy must be signed on the backend */
  relayPending?: boolean;
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
    ephemeralKeypair,
    onProgress = () => {},
    programId: userProvidedProgramId,
    programKeypair: providedProgramKeypair,
    /* NEW */ relayToBackend,
    verifyTimeoutMs = 60_000,
    projectId,
  } = options;
  
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or doesn't support signing");
  }
  
  // Cache the payer's public key to avoid repeated null checks
  const walletPublicKey = wallet.publicKey;
  const signatures: string[] = [];
  let programId: PublicKey | null = null;
  
  // Track the final program ID once it's determined. This allows error
  // handlers to report the correct ID even if the deployment is cancelled.
  let resolvedProgramId: PublicKey | null = null;
  
  try {
    // Convert ArrayBuffer to Uint8Array for processing
    const programData = new Uint8Array(soBytes);
    
    {
      const magic = [...programData.slice(0, 4)];
      console.log('[VERIFY] ELF magic', magic.map(b => b.toString(16).padStart(2,'0')));
      if (magic.join() !== '127,69,76,70') {      // 0x7f 45 4c 46
        throw new Error('❌ soBytes is not a valid ELF; aborting');
      }
    }
    
    const dataLength = programData.length;
    const bufferSpace = HEADER_LEN + dataLength;  // bufferSpace = 37-byte Buffer header + raw code length
    
    onProgress(0, "Generating ephemeral key...");
    console.log(`[EPHEMERAL_DEPLOY] Starting deployment, program size: ${dataLength} bytes`);
    
    // 1. Use the provided ephemeral keypair
    const bufferKp = ephemeralKeypair;
    console.log(`[EPHEMERAL_DEPLOY] Using ephemeral key: ${bufferKp.publicKey.toBase58()}`);
    
    // Register ephemeral key with backend (only send public key)
    try {
      if (projectId) {
        await fetch(`/api/projects/${projectId}/ephemeral`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pubkey: bufferKp.publicKey.toBase58() })
        });
      }
    } catch (err) {
      console.warn('Failed to register ephemeral key with backend:', err);
      // Continue anyway - not critical for the deployment
    }
    
    // 2. Create a buffer account (using a real keypair, not PDA)
    const bufferKey = Keypair.generate();
    
    // ── Program‑ID setup ──────────────────────────────────────────
    // Determine programId and keypair.
    // Priority:
    //  1. providedProgramKeypair   → new deploy (local/dev)
    //  2. relayToBackend && programId → new deploy (backend will sign)
    //  3. userProvidedProgramId    → upgrade
    //  3. Generate a new keypair (new deployment)   (only when **not** relaying)
    let programKeypair: Keypair | null = null;
    let programPublicKey: PublicKey | null = null;   // <- always the pubkey we deploy with
    if (providedProgramKeypair) {
      // caller handed us the full keypair → classic local‑secret flow
      programKeypair     = providedProgramKeypair;
      programPublicKey   = programKeypair.publicKey;
      programId          = programPublicKey;
      resolvedProgramId  = programId;
    } else if (userProvidedProgramId) {
      /*  NEW‑PROGRAM + relay (no secret in browser)
       *  We have only the public key; backend will add the signature later.   */
      programPublicKey   = userProvidedProgramId;
      programId          = userProvidedProgramId;
      resolvedProgramId  = programId;
    } else {
      // no predetermined key; generate a new program keypair (browser‑side only)
      if (relayToBackend) {
        throw new Error('Program ID is required when relayToBackend=true');
      }
      programKeypair   = Keypair.generate();
      programPublicKey = programKeypair.publicKey;
      programId        = programPublicKey;
      resolvedProgramId = programId;
    }
    
    // final fallback (should never hit)
    if (!programPublicKey) {
      programPublicKey = programKeypair!.publicKey;
    }

    const isNewProgram = Boolean(programKeypair) || relayToBackend;

    // Inform the caller about the chosen programId
    onProgress(1, `Using programId ${programId.toBase58()}`);

    const [programDataPubkey] = PublicKey.findProgramAddressSync(
      [programId.toBuffer()],
      BPF_UPGRADE_LOADER_ID,
    );
    
    // ------------------------------------------------------------------------
    // Freeze the resolved programId.  Without this defensive copy the mutable
    // `programId` variable can be reassigned later in this function (for
    // example, via the catch block), and any TransactionInstruction created
    // earlier still holds a reference to that variable.  If the variable is
    // overwritten, subsequent simulations and toast messages may reflect a
    // *different* program id than the one originally derived here.  Capture it
    // once and use the frozen value for all subsequent instructions, logging
    // and return values.
    resolvedProgramId = programId!; // assert non-null and assign to function-scoped variable
    
    console.log(`[EPHEMERAL_DEPLOY] Program ID: ${programId.toBase58()}`);
    console.log(`[EPHEMERAL_DEPLOY] Buffer: ${bufferKey.publicKey.toBase58()}`);
    
    // ---------- Extra guards when upgrading ----------
    if (!programKeypair) {
      const programDataInfo = await connection.getAccountInfo(programDataPubkey, 'confirmed');
      if (!programDataInfo) throw new Error('ProgramData PDA missing – wrong ID?');

      const curAuthority = new PublicKey(
        programDataInfo.data.slice(
          PROGRAMDATA_AUTHORITY_OFFSET,
          PROGRAMDATA_AUTHORITY_OFFSET + 32,
        ),
      );
      if (!curAuthority.equals(walletPublicKey)) {
        throw new Error('Wallet is NOT current upgrade authority');
      }

      const maxDataLen = programDataInfo.data.readUInt32LE(68); // DeployWithMaxDataLen spec
      if (dataLength > maxDataLen) {
        throw new Error(`Binary ${dataLength}B exceeds on-chain max ${maxDataLen}B`);
      }
    }
    
    // Calculate rent-exempt balances
    const bufferRent = BigInt(await connection.getMinimumBalanceForRentExemption(bufferSpace));
    const programRent = BigInt(
      await connection.getMinimumBalanceForRentExemption(PROGRAM_ACCOUNT_SPACE),
    );

    // ───────────────────────────────────────────────
    // NEW: rent for the ProgramData account that the
    // loader creates inside DeployWithMaxDataLen.
    // Size = bufferSpace bytes (37-byte header + code)
    // ───────────────────────────────────────────────
    const programDataRent =
      BigInt(await connection.getMinimumBalanceForRentExemption(bufferSpace));
    
    // === Fee estimation & funding ===
    const writeTxCount = Math.ceil(dataLength / CHUNK_SIZE);
    // Conservatively estimate fee - using a fixed value instead of prioritization fees
    const feePerTx = 10000; // conservative upper bound
    
    // Transactions the ephemeral key must pay for:
    //   writeTxCount  – chunk writes
    //   +1            – createBufferTx
    //   +1            – deploy OR upgrade
    //   +1            – post-deploy SetAuthority
    const totalFees = BigInt((writeTxCount + 3) * feePerTx);
    const rentForProg = programKeypair ? programRent : BigInt(0);
    const SAFETY_LAMPORTS = BigInt(100_000_000);            // 0.1 SOL
    
    const totalNeeded = bufferRent + rentForProg + programDataRent + totalFees + SAFETY_LAMPORTS;
    
    console.table({
      bufferRent:         bufferRent.toString(),
      programRentForFunding: rentForProg.toString(),
      programDataRent:    programDataRent.toString(),
      programAccountSpace: PROGRAM_ACCOUNT_SPACE,
      totalFees:          totalFees.toString(),
      SAFETY_LAMPORTS:    SAFETY_LAMPORTS.toString(),
      totalNeeded:        totalNeeded.toString(),
    });
    
    onProgress(5, "Funding ephemeral key...");
    
    /* -----------------------------------------------------------
     * 2.1  Fund the **ephemeral key** in a way Phantom can simulate
     *      happily: use  SystemProgram.createAccount  instead of a
     *      plain transfer.  The new account has 0 bytes of data and
     *      is owned by the System Program, so we still get the full
     *      lamports balance and can close / sweep it later.  
     * ---------------------------------------------------------- */
    const fundingTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey:       walletPublicKey,
        newAccountPubkey: bufferKp.publicKey,
        lamports:         Number(totalNeeded),
        space:            0,                       // no data needed
        programId:        SystemProgram.programId, // owner = system program
      }),
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
    
    // Wait for confirmation ­– use signature‑only form to avoid
    // "TransactionExpiredBlockheightExceededError" on slow networks
    await connection.confirmTransaction(fundingSig, 'confirmed');
    
    console.log(`[EPHEMERAL_DEPLOY] Funded ephemeral key with ${totalNeeded} lamports`);
    
    // 3. Now use the ephemeral key for buffer operations
    
    onProgress(10, "Creating buffer account...");
    
    // 3.1 Create the buffer account
    const createBufferTx = new Transaction()
      .add(
        SystemProgram.createAccount({
          fromPubkey: bufferKp.publicKey,
          newAccountPubkey: bufferKey.publicKey,
          // Only fund with buffer rent, not programDataRent
          lamports: parseInt(bufferRent.toString()),
          space: bufferSpace,
          programId: BPF_UPGRADE_LOADER_ID,
        })
      );
    
    const initBufferIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: bufferKey.publicKey,   isSigner: false, isWritable: true },
        { pubkey: bufferKp.publicKey,isSigner: true,  isWritable: false },
      ],
      data: u32LE(LoaderIx.InitializeBuffer),           // 4-byte tag
    });
    createBufferTx.add(initBufferIx);
    
    // Get a fresh blockhash for the buffer creation
    const bufferBlockhashInfo = await connection.getLatestBlockhash('confirmed');
    const bufferHash = bufferBlockhashInfo.blockhash;
    const bufferHeight = bufferBlockhashInfo.lastValidBlockHeight;
      
    createBufferTx.recentBlockhash = bufferHash;
    createBufferTx.feePayer = bufferKp.publicKey;
    
    // Sign with both the ephemeral key and buffer key
    createBufferTx.sign(bufferKp, bufferKey);
    
    // Send and confirm buffer creation
    const bufferSig = await connection.sendRawTransaction(
      createBufferTx.serialize(),
      SEND_NO_PREFLIGHT,          // ← skip on‑chain simulation
    );
    signatures.push(bufferSig);
    
    await connection.confirmTransaction(bufferSig, 'confirmed');
    
    console.log(`[EPHEMERAL_DEPLOY] Buffer account created`);
    
    // 3.2 Write program data in chunks
    const numChunks = Math.ceil(dataLength / CHUNK_SIZE);
    console.log(`[EPHEMERAL_DEPLOY] Writing program in ${numChunks} chunks`);
    
    if (RATE_LIMIT_MS < 50) {
      console.warn(
        `[DEPLOY] RATE_LIMIT_MS=${RATE_LIMIT_MS} may exceed QuickNode free burst limits; ` +
        `consider raising it in client/src/utils/connection.ts`
      );
    }
    
    const writeSigs: string[] = [];
    let lastSafeHashInfo: { blockhash: string; lastValidBlockHeight: number } | null = await getSafeHash(connection);
    
    // Set up WebSocket subscription for live logs
    const subId = connection.onLogs(
      bufferKey.publicKey,
      (l) => console.log('[ON-LOGS]', l.logs.join('\n')),
      'confirmed'
    );

    // Handle SIGINT to remove the log listener
    process.on('SIGINT', async () => {
      await connection.removeOnLogsListener(subId);
      process.exit(0);
    });

    for (let i = 0; i < numChunks; i++) {
      const offset = i * CHUNK_SIZE;
      const end = Math.min(offset + CHUNK_SIZE, dataLength);
      const chunk = programData.slice(offset, end);
      
      onProgress(10 + Math.floor((i / numChunks) * 70), 
                 `Writing chunk ${i+1}/${numChunks}...`);
      
      const offsetBuf = Buffer.allocUnsafe(4);
      offsetBuf.writeUInt32LE(offset, 0);          // offset (u32 LE)

      const lenBuf = u64LE(BigInt(chunk.length));       // Vec<u8> len = u64 LE

      const writeIx = new TransactionInstruction({
        programId: BPF_UPGRADE_LOADER_ID,
        keys: [
          { pubkey: bufferKey.publicKey,   isSigner: false, isWritable: true },
          { pubkey: bufferKp.publicKey,isSigner: true,  isWritable: false },
        ],
        data: Buffer.concat([
          u32LE(LoaderIx.Write),                          // 4-byte tag
          offsetBuf,                                      // u32 offset
          lenBuf,                                         // u64 length
          Buffer.from(chunk),                             // raw bytes
        ]),
      });
      
      if (i === 0) {
        console.log('[DEBUG] first-chunk offset', offset,
                    'len', chunk.length,
                    'tagLE', writeIx.data.slice(0,4),
                    'offsetLE', writeIx.data.slice(4,8),
                    'lenLE', writeIx.data.slice(8,16));
        
        const simTx = new Transaction().add(writeIx);
        // ① Add a recent block-hash so simulateTransaction passes
        {
          const { blockhash: simHash } = await connection.getLatestBlockhash('confirmed');
          simTx.recentBlockhash = simHash;
        }
        // Use *matching* fee‑payer for simulation so signature set matches the
        // real transaction's signer list.
        simTx.feePayer = bufferKp.publicKey;
        simTx.sign(bufferKp);
        const { value:{err, logs} } = await connection.simulateTransaction(simTx);
        console.log('[SIM-WRITE] err', err, '\nlogs', logs);
        if (err) throw new Error('Simulation of first Write failed: ' + JSON.stringify(err));
      }
      
      const writeTx = new Transaction().add(writeIx);
      
      // **Do NOT** fetch a new block-hash every chunk – reuse until interval reached
      if (i % SAFE_HASH_REFRESH_INTERVAL === 0) {
        lastSafeHashInfo = await getSafeHash(connection);
      }
      writeTx.recentBlockhash = lastSafeHashInfo!.blockhash;
      writeTx.feePayer = bufferKp.publicKey;
      
      // Sign with the ephemeral key
      writeTx.sign(bufferKp);
      
      // Send raw transaction without waiting for confirmation
      // We'll send them all quickly
      const writeSig = await connection.sendRawTransaction(
        writeTx.serialize(),
        SEND_NO_PREFLIGHT,
      );
      writeSigs.push(writeSig);
      
      // Small delay to avoid rate limiting
      await new Promise(res => setTimeout(res, RATE_LIMIT_MS));
    }
    
    // 3.3 Wait for all write transactions to be confirmed
    onProgress(80, "Verifying all writes...");
    console.log(`[EPHEMERAL_DEPLOY] Waiting for all write transactions to confirm...`);
    
    await connection.confirmTransaction(
      writeSigs[writeSigs.length - 1],
      'confirmed',
    );
    const statuses = await connection.getSignatureStatuses(writeSigs);
    statuses.value.forEach((st, idx) => {
      console.log('[WRITE-STATUS]', idx, st?.slot, st?.confirmations, st?.err);
      if (st && st.err) throw new Error(`Write TX #${idx} failed: ${JSON.stringify(st.err)}`);
    });
    
    // Clean up WebSocket subscription
    await connection.removeOnLogsListener(subId);
    
    /* -----------------------------------------------------------------
     * 3.4 – SHA-256 the finished buffer and compare to local .so
     * ----------------------------------------------------------------- */
    {
      const acct = await connection.getAccountInfo(bufferKey.publicKey, 'confirmed');
      if (!acct) throw new Error('Buffer account disappeared before verification');

      const remoteCode = acct.data.subarray(HEADER_LEN);     // strip 37-byte header
      const localHash  = createHash('sha256').update(programData).digest('hex');
      const remoteHash = createHash('sha256').update(remoteCode).digest('hex');

      console.log('[VERIFY] buffer sha256', { localHash, remoteHash });
      if (localHash !== remoteHash) {
        throw new Error('❌ Buffer hash mismatch – aborting deploy');
      }
      onProgress(82, 'Buffer verified ✔︎');
    }
    
    // 4. Deploy **or** upgrade the program ------------------------------------
    onProgress(85, programKeypair ? 'Deploying program…' : 'Upgrading program…');

    let deployOrUpgradeSig: string;
    let encodedTx: string | undefined;
    let relayPending: boolean | undefined;
    
    const isUpgrade = programKeypair === null && !relayToBackend;

    if (!isUpgrade) {
      // ------- NEW PROGRAM (DeployWithMaxDataLen) ---------------------------
      const createProgramAcct = SystemProgram.createAccount({
        fromPubkey: bufferKp.publicKey,
        newAccountPubkey: programPublicKey!,
        lamports: Number(programRent),
        space: PROGRAM_ACCOUNT_SPACE,
        programId: BPF_UPGRADE_LOADER_ID,
      });

      const deployIx = new TransactionInstruction({
        programId: BPF_UPGRADE_LOADER_ID,
        keys: [
          { pubkey: bufferKp.publicKey,  isSigner: true,  isWritable: true },  // payer
          { pubkey: programDataPubkey,       isSigner: false, isWritable: true },
          { pubkey: programPublicKey!, isSigner: true, isWritable: true },  // Program
          { pubkey: bufferKey.publicKey,     isSigner: false, isWritable: true },
          { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false },
          { pubkey: SYSVAR_CLOCK_PUBKEY,     isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: bufferKp.publicKey,  isSigner: true,  isWritable: false }, // authority = buffer authority
        ],
        data: Buffer.concat([
          u32LE(LoaderIx.DeployWithMaxDataLen),          // 4-byte tag
          u64LE(BigInt(dataLength)),                     // raw .so size only
        ]),
      });

      const deployTx = new Transaction()
        .add(createProgramAcct)
        .add(deployIx);

      const { blockhash: deployHash, lastValidBlockHeight: deployHeight } =
            await connection.getLatestBlockhash('confirmed');
      deployTx.recentBlockhash = deployHash;
      deployTx.feePayer = bufferKp.publicKey;
      
      if (relayToBackend) {
        /*  Front‑end signs only with buffer authority; backend will add
            the Program‑account signature using the secret key cached
            during the Anchor build. */
        deployTx.partialSign(bufferKp);
        const encodedTx = deployTx.serialize({ requireAllSignatures: false }).toString('base64');
        
        // ❸ send to backend for program‑key signature & broadcast
        if (!projectId) {
          throw new Error("Project ID required for relay to backend");
        }
        
        const relayRes = await fetch(`/api/projects/${projectId}/relayDeployTx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encodedTx, programId: programId.toBase58() })
        }).then(r => r.json());
        
        // relayRes.signature is the final on‑chain tx id
        signatures.push(relayRes.signature);
        
        return {
          programId,
          signatures,
          success: true,
          relayPending: false,
        };
      } else if (programKeypair) {
        /* Local secret available → sign with it right here */
        // Simulate the transaction first to catch any potential issues
        // ── DEBUG ── print all account keys & signer status
        const msg = deployTx.compileMessage();
        const signerKeys = deployTx.signatures.map(s => s.publicKey.toBase58());
        console.log('DEBUG deployTx accounts:',
          msg.accountKeys.map(
            (k,i)=>`${i}:${k.toBase58()}${signerKeys.includes(k.toBase58())?'*':''}`
          )
        );
        console.log('DEBUG feePayer =', deployTx.feePayer?.toBase58());
        console.log('DEBUG signers  =', signerKeys);
        const sim = await connection.simulateTransaction(deployTx);
        if (sim.value.err) {
          console.error('Simulation failure', sim.value.logs);
          throw new Error('Final deploy simulation failed');
        }
        
        deployOrUpgradeSig = await connection.sendRawTransaction(
          deployTx.serialize(),
          SEND_NO_PREFLIGHT,      // ← skip pre‑flight for DeployWithMaxDataLen
        );
        signatures.push(deployOrUpgradeSig);

        await connection.confirmTransaction({
          blockhash: deployHash,
          lastValidBlockHeight: deployHeight,
          signature: deployOrUpgradeSig,
        });
      }
    } else {  /* -------------------- UPGRADE PATH -------------------- */
      // ------- EXISTING PROGRAM (Upgrade) ------------------------------------
      const spillPubkey = walletPublicKey;   // lamports refund destination
      const upgradeIx = new TransactionInstruction({
        programId: BPF_UPGRADE_LOADER_ID,
        keys: [
          { pubkey: programDataPubkey,    isSigner: false, isWritable: true },
          { pubkey: resolvedProgramId!,   isSigner: false, isWritable: true },
          { pubkey: bufferKey.publicKey,  isSigner: false, isWritable: true },
          { pubkey: spillPubkey,          isSigner: false, isWritable: true },
          { pubkey: SYSVAR_RENT_PUBKEY,   isSigner: false, isWritable: false },
          { pubkey: SYSVAR_CLOCK_PUBKEY,  isSigner: false, isWritable: false },
          { pubkey: bufferKp.publicKey, isSigner: true,  isWritable: false }, // authority = buffer authority
        ],
        data: u32LE(LoaderIx.Upgrade), // Upgrade (u32 LE)
      });

      const upgradeTx = new Transaction().add(upgradeIx);
      const { blockhash: upHash, lastValidBlockHeight: upHeight } =
            await connection.getLatestBlockhash('confirmed');
      upgradeTx.recentBlockhash = upHash;
      upgradeTx.feePayer = bufferKp.publicKey;
      
      if (relayToBackend) {
        upgradeTx.partialSign(bufferKp);
        const encodedTx = upgradeTx.serialize({ requireAllSignatures: false }).toString('base64');
        
        // ❸ send to backend for program‑key signature & broadcast
        if (!projectId) {
          throw new Error("Project ID required for relay to backend");
        }
        
        const relayRes = await fetch(`/api/projects/${projectId}/relayDeployTx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encodedTx, programId: programId.toBase58() })
        }).then(r => r.json());
        
        // relayRes.signature is the final on‑chain tx id
        signatures.push(relayRes.signature);
        
        return {
          programId,
          signatures,
          success: true,
          relayPending: false,
        };
      } else {
        upgradeTx.sign(bufferKp);          // wallet already signed buffer writes

        // Simulate the transaction first to catch any potential issues
        // ── DEBUG ── print all account keys & signer status
        const msgUpgrade = upgradeTx.compileMessage();
        const signerKeysUpgrade = upgradeTx.signatures.map(s => s.publicKey.toBase58());
        console.log('DEBUG upgradeTx accounts:',
          msgUpgrade.accountKeys.map(
            (k,i)=>`${i}:${k.toBase58()}${signerKeysUpgrade.includes(k.toBase58())?'*':''}`
          )
        );
        console.log('DEBUG feePayer =', upgradeTx.feePayer?.toBase58());
        console.log('DEBUG signers  =', signerKeysUpgrade);
        const sim = await connection.simulateTransaction(upgradeTx);
        if (sim.value.err) {
          console.error('Simulation failure', sim.value.logs);
          throw new Error('Final upgrade simulation failed');
        }

        deployOrUpgradeSig = await connection.sendRawTransaction(
          upgradeTx.serialize(),
          SEND_NO_PREFLIGHT,      // ← skip pre‑flight for Upgrade
        );
        signatures.push(deployOrUpgradeSig);

        await connection.confirmTransaction({
          blockhash: upHash,
          lastValidBlockHeight: upHeight,
          signature: deployOrUpgradeSig,
        });
      }
    }

    // 5. Hand upgrade authority from ephemeral key to wallet
    onProgress(85, 'Transferring upgrade authority...');
    
    if (!relayToBackend) {
      const setAuthIx = new TransactionInstruction({
        programId: BPF_UPGRADE_LOADER_ID,
        keys: [
          { pubkey: programDataPubkey,     isSigner: false, isWritable: true },
          { pubkey: bufferKp.publicKey, isSigner: true, isWritable: false },  // old owner
          { pubkey: walletPublicKey,        isSigner: false, isWritable: false },  // new owner
        ],
        data: u32LE(LoaderIx.SetAuthority),
      });
      
      const setAuthTx = new Transaction().add(setAuthIx);
      const { blockhash: authHash, lastValidBlockHeight: authHeight } = 
            await connection.getLatestBlockhash('confirmed');
      setAuthTx.recentBlockhash = authHash;
      setAuthTx.feePayer       = bufferKp.publicKey;
      
      setAuthTx.sign(bufferKp);
      
      // Simulate the transaction first to catch any potential issues
      const simResult = await connection.simulateTransaction(setAuthTx);
      if (simResult.value.err) {
        console.error('SetAuthority simulation failure:', simResult.value.logs);
        throw new Error('SetAuthority simulation failed');
      }
      
      const authSig = await connection.sendRawTransaction(
        setAuthTx.serialize(),
        SEND_NO_PREFLIGHT,        // ← skip pre‑flight for SetAuthority
      );
      signatures.push(authSig);
      
      // ⚡ Use the lighter 'confirmed' level so we return in ~1–2 s instead of ~15 s
      const authResult = await connection.confirmTransaction(
        { blockhash: authHash, lastValidBlockHeight: authHeight, signature: authSig },
        'confirmed',
      );
      
      if (authResult.value.err) {
        throw new Error(`SetAuthority transaction failed: ${JSON.stringify(authResult.value.err)}`);
      }
      
      // Optionally fetch the transaction to check for runtime errors
      const txInfo = await connection.getParsedTransaction(authSig, 'confirmed');
      if (txInfo?.meta?.err) {
        throw new Error(`SetAuthority had runtime error: ${JSON.stringify(txInfo.meta.err)}`);
      }
      
      onProgress(90, 'Authority tx confirmed — verifying on-chain…');
      
      // ── Verify authority change with an explicit AccountInfo fetch ──────
      onProgress(95, 'Verifying Authority is now wallet...');
      
      // Poll for a while (30 s default) to wait for the authority to change
      const startTime = Date.now();
      let currentAuth = null;
      
      while (Date.now() - startTime < verifyTimeoutMs) {
        const programData = await connection.getAccountInfo(programDataPubkey, 'confirmed');
        if (!programData) {
          console.warn(`Program data account not found for ${resolvedProgramId!.toBase58()} – retrying…`);
          await new Promise(r => setTimeout(r, 2_000));  // short delay
          continue;
        }
        
        const buffer = programData.data.slice(
          PROGRAMDATA_AUTHORITY_OFFSET,       // 13: after enum + slot
          PROGRAMDATA_AUTHORITY_OFFSET + 32,  // 45: program auth pubkey
        );
        currentAuth = new PublicKey(buffer);
        console.log('[AUTH-CHECK] current:', currentAuth.toBase58());
        
        // Simple check if the authority equals the wallet addr now
        if (currentAuth.equals(walletPublicKey)) {
          console.log('[AUTH-CHECK] Authority correctly set to wallet');
          break;
        }
        
        console.log('[AUTH-CHECK] Authority not yet changed – retrying in 2s...');
        await new Promise(r => setTimeout(r, 2_000));  // short delay
      }
      
      // If we exit the loop and the auth is still not the wallet, warn + set a warning
      const warningMsg = 
        currentAuth && !currentAuth.equals(walletPublicKey)
          ? `⚠️ Authority is still set to ${currentAuth.toBase58()} after timeout. ` +
            `Expected ${walletPublicKey.toBase58()}. You may need to manually run SetAuthority.`
          : undefined;
      
      if (warningMsg) {
        console.warn(warningMsg);
      }
    } // end !relayToBackend

    /* -----------------------------------------------------------------
     * 6 – SHA-256 the ProgramData PDA and compare again
     * ----------------------------------------------------------------- */
    {
      const progAcct = await connection.getAccountInfo(programDataPubkey, 'confirmed');
      if (!progAcct) throw new Error('ProgramData account not found for final verification');

      // ProgramData header = 4(tag)+8(slot)+1(opt)+32(key) = 45
      const PDA_HEADER = PROGRAMDATA_HEADER;   // 45
      const remoteProg = progAcct.data.subarray(PDA_HEADER);

      const finalHash = createHash('sha256').update(remoteProg).digest('hex');
      const buildHash = createHash('sha256').update(programData).digest('hex');

      console.log('[VERIFY] program sha256', { buildHash, finalHash });
      if (finalHash !== buildHash) {
        throw new Error('❌ Program hash mismatch – deployment corrupted');
      }
      onProgress(98, 'On-chain program verified ✔︎');
    }

    const ix = new TransactionInstruction({
      programId: resolvedProgramId, keys: [], data: Buffer.alloc(0)   // will fail gracefully
    });
    const testTx = new Transaction().add(ix);
    // ② Add a recent block-hash for the final simulate
    {
      const { blockhash: testHash } = await connection.getLatestBlockhash('confirmed');
      testTx.recentBlockhash = testHash;
    }
    testTx.feePayer = walletPublicKey;
    const sim = await connection.simulateTransaction(testTx);
    console.log('[SIM-INVOKE] logs', sim.value.logs);

    // --------- Close buffer & refund rent ----------
    try {
      const lamportsLeft = await connection.getBalance(bufferKey.publicKey, 'confirmed');
      if (lamportsLeft > 0) {
        const closeIx = SystemProgram.transfer({
          fromPubkey: bufferKey.publicKey,
          toPubkey: walletPublicKey,
          lamports: lamportsLeft,
        });
        const closeTx = new Transaction().add(closeIx);
        closeTx.feePayer = bufferKp.publicKey;

        const { blockhash: cHash, lastValidBlockHeight: cHeight } =
              await connection.getLatestBlockhash('confirmed');
        closeTx.recentBlockhash = cHash;
        closeTx.sign(bufferKp, bufferKey);

        await connection.sendRawTransaction(closeTx.serialize(), SEND_WITH_PREFLIGHT);
        console.log('[CLOSE] Buffer account closed; rent refunded');
      }
    } catch (e) {
      console.warn('[CLOSE] Could not close buffer:', e);
    }

    console.log(
      `[EPHEMERAL_DEPLOY] Program deployed successfully to ${resolvedProgramId.toBase58()}`,
    );
    onProgress(100, "Deployment successful!");
    
    return {
      programId: resolvedProgramId,
      signatures,
      success: true,
      encodedTx,
      relayPending,
    };
  } catch (e: any) {
    console.error('RAW ERROR', e);
    // web3.js puts logs in `e.logs` (v1.95+) or `e.data.logs` (older)
    console.error('ERROR LOGS:', e.logs ?? e.data?.logs ?? []);
    onProgress(99, "Deployment failed - check console for details");

    return {
      // Use the resolved ID if available; fall back to programId or default
      programId: resolvedProgramId ?? programId ?? PublicKey.default,
      signatures,
      success: false
    };
  }
} 