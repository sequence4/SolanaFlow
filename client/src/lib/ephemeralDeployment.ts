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
  /** The **already-generated** Keypair that must become program upgrade authority */
  ephemeralKeypair: Keypair;
  /** progress ∈ [0-100], plus human log line */
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
    ephemeralKeypair,
    onProgress = () => {},
    programId: userProvidedProgramId,
  } = options;
  
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or doesn't support signing");
  }
  
  // Cache the payer's public key to avoid repeated null checks
  const walletPublicKey = wallet.publicKey;
  const signatures: string[] = [];
  let programId: PublicKey | null = null;
  
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
    const ephemeralKey = ephemeralKeypair;
    console.log(`[EPHEMERAL_DEPLOY] Using ephemeral key: ${ephemeralKey.publicKey.toBase58()}`);
    
    // 2. Create a buffer account (using a real keypair, not PDA)
    const bufferKey = Keypair.generate();
    
    // ── Program-id setup ──────────────────────────────────────────
    let programKeypair: Keypair | null = null;

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
    
    // 2.1 Create a transaction to fund the ephemeral key
    const fundingTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey: ephemeralKey.publicKey,
        lamports: Number(totalNeeded),
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
    const createBufferTx = new Transaction()
      .add(
        SystemProgram.createAccount({
          fromPubkey: ephemeralKey.publicKey,
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
        { pubkey: ephemeralKey.publicKey,isSigner: true,  isWritable: false },
      ],
      data: u32LE(LoaderIx.InitializeBuffer),           // 4-byte tag
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
    const bufferSig = await connection.sendRawTransaction(
      createBufferTx.serialize(),
      SEND_WITH_PREFLIGHT,
    );
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
          { pubkey: ephemeralKey.publicKey,isSigner: true,  isWritable: false },
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
        simTx.feePayer = walletPublicKey;
        simTx.sign(ephemeralKey);
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
      writeTx.feePayer = ephemeralKey.publicKey;
      
      // Sign with the ephemeral key
      writeTx.sign(ephemeralKey);
      
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
    
    await connection.confirmTransaction({
      signature: writeSigs[writeSigs.length - 1],
      blockhash: lastSafeHashInfo!.blockhash,
      lastValidBlockHeight: lastSafeHashInfo!.lastValidBlockHeight,
    });
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

    if (programKeypair) {
      // ------- NEW PROGRAM (DeployWithMaxDataLen) ---------------------------
      const createProgramAcct = SystemProgram.createAccount({
        fromPubkey: ephemeralKey.publicKey,
        newAccountPubkey: programKeypair.publicKey,
        lamports: Number(programRent),
        space: PROGRAM_ACCOUNT_SPACE,
        programId: BPF_UPGRADE_LOADER_ID,
      });

      const deployIx = new TransactionInstruction({
        programId: BPF_UPGRADE_LOADER_ID,
        keys: [
          { pubkey: ephemeralKey.publicKey,  isSigner: true,  isWritable: true },  // payer
          { pubkey: programDataPubkey,       isSigner: false, isWritable: true },
          { pubkey: programKeypair.publicKey,isSigner: true,  isWritable: true },  // Program
          { pubkey: bufferKey.publicKey,     isSigner: false, isWritable: true },
          { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false },
          { pubkey: SYSVAR_CLOCK_PUBKEY,     isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: ephemeralKey.publicKey,  isSigner: true,  isWritable: false }, // authority = buffer authority
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
      deployTx.feePayer = ephemeralKey.publicKey;
      deployTx.sign(ephemeralKey, programKeypair);      // wallet no longer signs

      // Simulate the transaction first to catch any potential issues
      const sim = await connection.simulateTransaction(deployTx);
      if (sim.value.err) {
        console.error('Simulation failure', sim.value.logs);
        throw new Error('Final deploy simulation failed');
      }
      
      deployOrUpgradeSig = await connection.sendRawTransaction(
        deployTx.serialize(),
        SEND_WITH_PREFLIGHT,
      );
      signatures.push(deployOrUpgradeSig);

      await connection.confirmTransaction({
        blockhash: deployHash,
        lastValidBlockHeight: deployHeight,
        signature: deployOrUpgradeSig,
      });
    } else {
      // ------- EXISTING PROGRAM (Upgrade) ------------------------------------
      const spillPubkey = walletPublicKey;   // lamports refund destination
      const upgradeIx = new TransactionInstruction({
        programId: BPF_UPGRADE_LOADER_ID,
        keys: [
          { pubkey: programDataPubkey,    isSigner: false, isWritable: true },
          { pubkey: programId,            isSigner: false, isWritable: true },
          { pubkey: bufferKey.publicKey,  isSigner: false, isWritable: true },
          { pubkey: spillPubkey,          isSigner: false, isWritable: true },
          { pubkey: SYSVAR_RENT_PUBKEY,   isSigner: false, isWritable: false },
          { pubkey: SYSVAR_CLOCK_PUBKEY,  isSigner: false, isWritable: false },
          { pubkey: ephemeralKey.publicKey, isSigner: true,  isWritable: false }, // authority = buffer authority
        ],
        data: u32LE(LoaderIx.Upgrade), // Upgrade (u32 LE)
      });

      const upgradeTx = new Transaction().add(upgradeIx);
      const { blockhash: upHash, lastValidBlockHeight: upHeight } =
            await connection.getLatestBlockhash('confirmed');
      upgradeTx.recentBlockhash = upHash;
      upgradeTx.feePayer = ephemeralKey.publicKey;
      upgradeTx.sign(ephemeralKey);          // wallet already signed buffer writes

      // Simulate the transaction first to catch any potential issues
      const sim = await connection.simulateTransaction(upgradeTx);
      if (sim.value.err) {
        console.error('Simulation failure', sim.value.logs);
        throw new Error('Final upgrade simulation failed');
      }

      deployOrUpgradeSig = await connection.sendRawTransaction(
        upgradeTx.serialize(),
        SEND_WITH_PREFLIGHT,
      );
      signatures.push(deployOrUpgradeSig);

      await connection.confirmTransaction({
        blockhash: upHash,
        lastValidBlockHeight: upHeight,
        signature: deployOrUpgradeSig,
      });
    }

    // 5. Hand upgrade authority from ephemeral key → wallet -------------------
    const setAuthIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: programDataPubkey,      isSigner: false, isWritable: true },  // ProgramData
        { pubkey: ephemeralKey.publicKey, isSigner: true,  isWritable: false }, // current authority
        { pubkey: walletPublicKey,        isSigner: false, isWritable: false }, // NEW -- the future authority
      ],
      data: u32LE(LoaderIx.SetAuthority), // ✅ only 4-byte tag
    });

    const setAuthTx = new Transaction().add(setAuthIx);
    setAuthTx.feePayer = ephemeralKey.publicKey;

    const { blockhash: authHash, lastValidBlockHeight: authHeight } =
          await connection.getLatestBlockhash('confirmed');
    setAuthTx.recentBlockhash = authHash;

    setAuthTx.sign(ephemeralKey);
    
    // Simulate the transaction first to catch any potential issues
    const simResult = await connection.simulateTransaction(setAuthTx);
    if (simResult.value.err) {
      console.error('SetAuthority simulation failure:', simResult.value.logs);
      throw new Error('SetAuthority simulation failed');
    }

    const authSig = await connection.sendRawTransaction(
      setAuthTx.serialize(),
      SEND_WITH_PREFLIGHT,
    );
    signatures.push(authSig);

    const authResult = await connection.confirmTransaction({
      blockhash: authHash,
      lastValidBlockHeight: authHeight,
      signature: authSig,
    });
    
    if (authResult.value.err) {
      throw new Error(`SetAuthority transaction failed: ${JSON.stringify(authResult.value.err)}`);
    }
    
    // Optionally fetch the transaction to check for runtime errors
    const txInfo = await connection.getParsedTransaction(authSig, 'confirmed');
    if (txInfo?.meta?.err) {
      throw new Error(`SetAuthority had runtime error: ${JSON.stringify(txInfo.meta.err)}`);
    }

    // Use `confirmed` (or even `processed`) first, then fall back to `finalized`
    const COMMIT = 'finalized';          // Devnet nodes show PDA sooner in this layer
    let retries = 120;                   // 60 s max with 500 ms sleep
    let newAuth: PublicKey | null = null;

    while (retries-- > 0) {
      const pdaInfo = await connection.getAccountInfo(programDataPubkey, COMMIT as any);
      if (pdaInfo) {
        const optTag = pdaInfo.data[PROGRAMDATA_AUTHORITY_OFFSET];   // COption tag
        if (optTag === 1) {                                          // Some(pubkey)
          newAuth = new PublicKey(
            pdaInfo.data.slice(
              PROGRAMDATA_AUTHORITY_OFFSET + 1,
              PROGRAMDATA_AUTHORITY_OFFSET + 33,
            ),
          );
          if (newAuth.equals(walletPublicKey)) break;                // ✅ success
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }

    if (!newAuth?.equals(walletPublicKey)) {
      throw new Error(
        `Authority transfer not visible after ${(120 - retries) * 0.5}s – ` +
        `check RPC lag or tx failure (sig ${authSig})`
      );
    }

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
      programId, keys: [], data: Buffer.alloc(0)   // will fail gracefully
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
        closeTx.feePayer = ephemeralKey.publicKey;

        const { blockhash: cHash, lastValidBlockHeight: cHeight } =
              await connection.getLatestBlockhash('confirmed');
        closeTx.recentBlockhash = cHash;
        closeTx.sign(ephemeralKey, bufferKey);

        await connection.sendRawTransaction(closeTx.serialize(), SEND_WITH_PREFLIGHT);
        console.log('[CLOSE] Buffer account closed; rent refunded');
      }
    } catch (e) {
      console.warn('[CLOSE] Could not close buffer:', e);
    }

    console.log(`[EPHEMERAL_DEPLOY] Program deployed successfully to ${programId.toBase58()}`);
    onProgress(100, "Deployment successful!");
    
    return {
      programId,
      signatures,
      success: true
    };
  } catch (e: any) {
    console.error('RAW ERROR', e);
    // web3.js puts logs in `e.logs` (v1.95+) or `e.data.logs` (older)
    console.error('ERROR LOGS:', e.logs ?? e.data?.logs ?? []);
    onProgress(99, "Deployment failed - check console for details");
    return {
      programId: programId ?? PublicKey.default,
      signatures,
      success: false
    };
  }
} 