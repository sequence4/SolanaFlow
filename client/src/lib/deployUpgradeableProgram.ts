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
const HEADER_LEN = 8;   // loader metadata (see size_of_buffer)

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
        leU32(0),   // variant = InitializeBuffer
        leU32(0),   // COption<Pubkey>::None discriminant
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
      .add(createBufAcct)
      .add(initBufIx);
    createBufferTx.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
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
    
    // Cache blockhash for 2½ minutes to reduce RPC calls
    let { blockhash: cachedHash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const currentBlockHeight = await connection.getBlockHeight();
    
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
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
      
      const writeIx = new TransactionInstruction({
        programId: BPF_UPGRADE_LOADER_ID,
        keys: [
          { pubkey: bufferKey.publicKey, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey,  isSigner: true,  isWritable: false },
        ],
        data: Buffer.concat([
          leU32(1),                         // tag = Write
          leU32(offset),                    // offset
          leU64(BigInt(chunk.length)),      // bytes.len() as u64
          Buffer.from(chunk),               // raw bytes
        ]),
      });
      
      const writeTx = new Transaction().add(writeIx);
      writeTx.feePayer = wallet.publicKey;
      
      // Reuse cached blockhash when possible
      if (currentBlockHeight > lastValidBlockHeight - 150) {
        ({ blockhash: cachedHash, lastValidBlockHeight } = await connection.getLatestBlockhash());
      }
      writeTx.recentBlockhash = cachedHash;
      
      try {
        // Sign and send write transaction
        const signedWriteTx = await wallet.signTransaction(writeTx);
        const writeSignature = await connection.sendRawTransaction(signedWriteTx.serialize());
        signatures.push(writeSignature);
        
        // Wait for confirmation
        await connection.confirmTransaction(writeSignature);
        console.log(`[DEPLOY] Chunk ${chunkIndex + 1} written successfully. Signature: ${writeSignature}`);
      } catch (error) {
        console.error(`[DEPLOY] Failed to write chunk ${chunkIndex + 1}:`, error);
        throw new Error(`Failed to write chunk ${chunkIndex + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // 4. Deploy from buffer
    onProgress?.({
      stage: 'deploy',
      uploaded: dataLength,
      total: dataLength
    });
    
    console.log(`[DEPLOY] All chunks written. Deploying program with ID: ${programId.toBase58()}`);
    
    const deployIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        // 0. [signer] payer
        { pubkey: wallet.publicKey!,    isSigner: true,  isWritable: true },
        // 1. [writable] uninitialised ProgramData PDA
        { pubkey: programDataPubkey,    isSigner: false, isWritable: true },
        // 2. [writable, signer] Program account
        { pubkey: programKey.publicKey, isSigner: true,  isWritable: true },
        // 3. [writable] Buffer
        { pubkey: bufferKey.publicKey,  isSigner: false, isWritable: true },
        // 4. [] Rent sysvar
        { pubkey: SYSVAR_RENT_PUBKEY,   isSigner: false, isWritable: false },
        // 5. [] Clock sysvar
        { pubkey: SYSVAR_CLOCK_PUBKEY,  isSigner: false, isWritable: false },
        // 6. [] System program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        // 7. [signer] program authority (can reuse wallet key)
        { pubkey: wallet.publicKey!,    isSigner: true,  isWritable: false },
      ],
      data: Buffer.concat([
        leU32(3),  // 4-byte tag = DeployWithMaxDataLen
        Buffer.from(new Uint32Array([bufferSpace]).buffer),
      ]),
    });
    
    const deployTx = new Transaction()
      .add(createProgAcct)   // must precede loader call
      .add(deployIx);
    
    deployTx.feePayer = wallet.publicKey;
    const { blockhash: deployBlockhash } = await connection.getLatestBlockhash();
    deployTx.recentBlockhash = deployBlockhash;
    
    // Sign and send deploy transaction
    deployTx.partialSign(bufferKey, programKey);
    const signedDeployTx = await wallet.signTransaction(deployTx);
    const deploySignature = await connection.sendRawTransaction(signedDeployTx.serialize());
    signatures.push(deploySignature);
    
    // Wait for confirmation
    await connection.confirmTransaction(deploySignature);
    console.log(`[DEPLOY] Program deployed successfully. Signature: ${deploySignature}`);
    
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