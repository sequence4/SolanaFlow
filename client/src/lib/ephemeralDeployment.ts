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

// Buffer header = 4-byte state enum + 1-byte COption + 32-byte authority = 37 bytes
const HEADER_LEN = 37;

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

// Re-use these options for every raw TX that the wallet does **not** sign.
// Skipping pre-flight avoids "Blockhash not found" simulations.
const SEND_OPTS: SendOptions = { skipPreflight: true };

/**
 * Gets a blockhash that's already 45 blocks old, giving you ~105 blocks of validity
 * Only use this in very slow networks or when you need extra buffer time
 */
async function getSafeHash(conn: Connection): Promise<{ blockhash: string, lastValidBlockHeight: number }> {
  const { blockhash, lastValidBlockHeight } =
      await conn.getLatestBlockhash({ commitment: 'confirmed' });
  
  try {
    // Try to get an older **slot** if available (≈45 blocks old)
    const currentSlot = await conn.getSlot('confirmed');
    const safeSlot    = currentSlot - 105;
    if (safeSlot > 0) {
      // NEW: pass maxSupportedTransactionVersion so QuickNode doesn't reject the call
      const oldBlock = await conn.getBlock(
        safeSlot,
        { commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
      );
      if (oldBlock && oldBlock.blockhash) {
        console.log(`[DEPLOY] Using older blockhash with ~105 blocks of validity remaining`);
        const safeHeight = lastValidBlockHeight - 105;
        return { blockhash: oldBlock.blockhash, lastValidBlockHeight: safeHeight };
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
 * Encodes a positive integer using the same "little-endian base-128" varint
 * format that bincode's StandardOptions use on chain.
 */
function encodeUvarint(value: number | bigint): Buffer {
  let v = BigInt(value);
  const out: number[] = [];
  while (v >= BigInt(0x80)) {
    out.push(Number((v & BigInt(0x7F)) | BigInt(0x80)));
    v >>= BigInt(7);
  }
  out.push(Number(v));
  return Buffer.from(out);
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
  
  // Convert ArrayBuffer to Uint8Array for processing
  const programData = new Uint8Array(soBytes);
  const dataLength = programData.length;
  const bufferSpace = HEADER_LEN + dataLength;
  
  onProgress(0, "Generating ephemeral key...");
  console.log(`[EPHEMERAL_DEPLOY] Starting deployment, program size: ${dataLength} bytes`);
  
  // 1. Use the provided ephemeral keypair
  const ephemeralKey = ephemeralKeypair;
  console.log(`[EPHEMERAL_DEPLOY] Using ephemeral key: ${ephemeralKey.publicKey.toBase58()}`);
  
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
  const feePerTx = 10000; // conservative upper bound

  // Transactions the ephemeral key must pay for:
  //   writeTxCount  – chunk writes
  //   +1            – createBufferTx
  //   +1            – deploy OR upgrade
  //   +1            – post-deploy SetAuthority
  const totalFees = (writeTxCount + 3) * feePerTx;

  // When upgrading an existing program we do **not** have to fund rent
  // for a new Program account.
  const programRentForFunding = programKeypair ? programRent : 0;

  const totalNeeded = bufferRent + programRentForFunding + totalFees;
  
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
  const createBufferTx = new Transaction()
    .add(
      SystemProgram.createAccount({
        fromPubkey: ephemeralKey.publicKey,
        newAccountPubkey: bufferKey.publicKey,
        lamports: bufferRent,
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
    data: Buffer.from([LoaderIx.InitializeBuffer]), // 1-byte discriminant – no extra fields
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
    SEND_OPTS,
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
  
  const SAFE_HASH_REFRESH_INTERVAL = 32;   // refresh every N chunks

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
        Buffer.from([LoaderIx.Write]),       // 1-byte discriminant
        encodeUvarint(offset),               // varint-u32 offset
        encodeUvarint(chunk.length),         // varint-u64 length
        Buffer.from(chunk),                  // raw bytes
      ]),
    });
    
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
      SEND_OPTS,
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
  statuses.value.forEach((st, i) => {
    if (st && st.err) throw new Error(`Write TX #${i} failed: ${JSON.stringify(st.err)}`);
  });
  
  // 4. Deploy **or** upgrade the program ------------------------------------
  onProgress(85, programKeypair ? 'Deploying program…' : 'Upgrading program…');

  let deployOrUpgradeSig: string;

  if (programKeypair) {
    // ------- NEW PROGRAM (DeployWithMaxDataLen) ---------------------------
    const createProgramAcct = SystemProgram.createAccount({
      fromPubkey: ephemeralKey.publicKey,
      newAccountPubkey: programKeypair.publicKey,
      lamports: programRent,
      space: 0,
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
        Buffer.from([LoaderIx.DeployWithMaxDataLen]), // DeployWithMaxDataLen (u8)
        encodeUvarint(bufferSpace),                   // max_data_len (varint-u32)
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

    deployOrUpgradeSig = await connection.sendRawTransaction(
      deployTx.serialize(),
      SEND_OPTS,
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
      data: Buffer.from([LoaderIx.Upgrade]), // Upgrade (u8)
    });

    const upgradeTx = new Transaction().add(upgradeIx);
    const { blockhash: upHash, lastValidBlockHeight: upHeight } =
          await connection.getLatestBlockhash('confirmed');
    upgradeTx.recentBlockhash = upHash;
    upgradeTx.feePayer = ephemeralKey.publicKey;
    upgradeTx.sign(ephemeralKey);          // wallet already signed buffer writes

    deployOrUpgradeSig = await connection.sendRawTransaction(
      upgradeTx.serialize(),
      SEND_OPTS,
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
      { pubkey: programDataPubkey,      isSigner: false, isWritable: true },
      { pubkey: ephemeralKey.publicKey, isSigner: true,  isWritable: false }, // current authority
      { pubkey: walletPublicKey,        isSigner: false, isWritable: false }, // new authority
    ],
    data: Buffer.from([LoaderIx.SetAuthority]), // SetAuthority (u8)
  });

  const setAuthTx = new Transaction().add(setAuthIx);
  setAuthTx.feePayer = ephemeralKey.publicKey;

  const { blockhash: authHash, lastValidBlockHeight: authHeight } =
        await connection.getLatestBlockhash('confirmed');
  setAuthTx.recentBlockhash = authHash;

  setAuthTx.sign(ephemeralKey);

  const authSig = await connection.sendRawTransaction(
    setAuthTx.serialize(),
    SEND_OPTS,
  );
  signatures.push(authSig);

  await connection.confirmTransaction({
    blockhash: authHash,
    lastValidBlockHeight: authHeight,
    signature: authSig,
  });

  console.log(`[EPHEMERAL_DEPLOY] Program deployed successfully to ${programId.toBase58()}`);
  onProgress(100, "Deployment successful!");
  
  return {
    programId,
    signatures,
    success: true
  };
} 