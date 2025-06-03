import {
  Connection,
  PublicKey,
  TransactionInstruction,
  Transaction,
  SendTransactionError,
} from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";

const BPF_UPGRADE_LOADER_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const CHUNK_SIZE = 900; // Standard chunk size for Solana BPF loader

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
  const signatures: string[] = [];
  
  console.log(`[DEPLOY] Starting program deployment, program size: ${dataLength} bytes`);
  
  // 1. Derive buffer PDA
  const [bufferPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("buffer_seed")], 
    BPF_UPGRADE_LOADER_ID
  );
  
  // If programId not provided, derive a new one
  const programId = userProvidedProgramId || new PublicKey(wallet.publicKey.toBytes().slice(0, 32));
  
  console.log(`[DEPLOY] Buffer PDA: ${bufferPda.toBase58()}`);
  console.log(`[DEPLOY] Program ID: ${programId.toBase58()}`);
  
  try {
    // 2. createBuffer transaction
    onProgress?.({ 
      stage: 'create',
      uploaded: 0,
      total: dataLength 
    });
    
    const createBufferIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: bufferPda, isSigner: false, isWritable: true },
      ],
      data: Buffer.concat([
        Buffer.from([0]), // CreateBuffer instruction
        Buffer.from(new Uint32Array([dataLength]).buffer) // size as LE u32
      ]),
    });
    
    const createBufferTx = new Transaction().add(createBufferIx);
    createBufferTx.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    createBufferTx.recentBlockhash = blockhash;
    
    // Sign and send the createBuffer transaction
    const signedCreateBufferTx = await wallet.signTransaction(createBufferTx);
    const createBufferSig = await connection.sendRawTransaction(signedCreateBufferTx.serialize());
    signatures.push(createBufferSig);
    
    // Wait for confirmation
    await connection.confirmTransaction(createBufferSig);
    console.log(`[DEPLOY] Buffer created successfully. Signature: ${createBufferSig}`);
    
    // 3. Write program data in chunks
    const numChunks = Math.ceil(dataLength / CHUNK_SIZE);
    console.log(`[DEPLOY] Writing program data in ${numChunks} chunks of max ${CHUNK_SIZE} bytes each`);
    
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      const offset = chunkIndex * CHUNK_SIZE;
      const chunkEnd = Math.min(offset + CHUNK_SIZE, dataLength);
      const chunkSize = chunkEnd - offset;
      const chunk = programData.slice(offset, chunkEnd);
      
      onProgress?.({
        stage: 'write',
        uploaded: offset,
        total: dataLength,
        chunkIndex,
        totalChunks: numChunks
      });
      
      console.log(`[DEPLOY] Writing chunk ${chunkIndex + 1}/${numChunks}, offset: ${offset}, size: ${chunkSize} bytes`);
      
      const writeIx = new TransactionInstruction({
        programId: BPF_UPGRADE_LOADER_ID,
        keys: [
          { pubkey: bufferPda, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        ],
        data: Buffer.concat([
          Buffer.from([1]), // Write instruction
          Buffer.from(new Uint32Array([offset]).buffer), // offset as LE u32
          Buffer.from(chunk), // chunk data
        ]),
      });
      
      const writeTx = new Transaction().add(writeIx);
      writeTx.feePayer = wallet.publicKey;
      const { blockhash: writeBlockhash } = await connection.getLatestBlockhash();
      writeTx.recentBlockhash = writeBlockhash;
      
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
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: bufferPda, isSigner: false, isWritable: true },
        { pubkey: programId, isSigner: false, isWritable: true },
      ],
      data: Buffer.from([2]), // DeployWithMaxProgramLen instruction
    });
    
    const deployTx = new Transaction().add(deployIx);
    deployTx.feePayer = wallet.publicKey;
    const { blockhash: deployBlockhash } = await connection.getLatestBlockhash();
    deployTx.recentBlockhash = deployBlockhash;
    
    // Sign and send deploy transaction
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