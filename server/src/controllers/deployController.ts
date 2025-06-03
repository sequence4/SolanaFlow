import { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { runDeployPipeline } from '../utils/deploy/runDeployPipeline';
import { Graph } from '../types/graph'; 
import { broadcastSignedTx } from '../utils/projectUtils';
import {
  Connection, Transaction, Keypair, PublicKey,
  SystemProgram, TransactionInstruction
} from "@solana/web3.js";
import fs from 'fs';
import path from 'path';
import { getProjectRootPath } from '../utils/fileUtils';
import { getContainerName } from '../utils/projectUtils';
import { deriveProgramId } from "../utils/deriveProgramId";

// BPF Loader Upgradeable Program ID
const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

/**
 * POST /api/deploy/:id/deploy-pipeline
 * Streams Server-Sent Events while the build/deploy pipeline runs.
 */
export async function deployPipeline(
  req: Request<{ id: string }, unknown, { graph: Graph; walletSigned?: boolean }>,
  res: Response,
  next: NextFunction,
) {
  const { id }    = req.params;
  const { graph, walletSigned: requestWalletSigned } = req.body;
  const userId    = (req.user as { id?: string } | undefined)?.id; // keep optional-chaining safe
  const walletSigned = requestWalletSigned === true;

  console.log(`[API] Deploy pipeline called for project: ${id}, userId: ${userId}`);
  console.log(`[API] Graph data received:`, JSON.stringify(graph).substring(0, 200) + '…');
  console.log(`[API] Wallet-signed deployment: ${walletSigned}`);

  /* ------------------------------------------------------------------ *
   * Guards – bail out fast on bad input
   * ------------------------------------------------------------------ */
  if (!userId) return next(new AppError('User not found', 400));

  // Basic shape validation so runDeployPipeline never receives garbage
  if (!graph?.nodes || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return next(new AppError('Graph must include at least one node', 400)); // :contentReference[oaicite:1]{index=1}
  }

  /* ------------------------------------------------------------------ *
   * Setup Server-Sent Events response
   * ------------------------------------------------------------------ */
  res.writeHead(200, {
    'Content-Type': 'text/event-stream', // official MIME type for SSE :contentReference[oaicite:2]{index=2}
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Generic helper keeps TypeScript happy for every event payload
  const send = <T = unknown>(data: T): void => {
    console.log('[API] Sending SSE event:', data);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  /* ------------------------------------------------------------------ *
   * Execute the long-running pipeline
   * ------------------------------------------------------------------ */
  try {
    await runDeployPipeline({ 
      projectId: id, 
      userId, 
      graph, 
      sendProgress: send,
      walletSigned
    });

    // let the client know we're done, then close the SSE stream
    send({ stage: 'completed', message: 'Pipeline finished' });
    res.end();
  } catch (err) {
    console.error('[API] Deploy pipeline error:', err);
    send({ stage: 'error', message: (err as Error).message });
    res.end();
    if (!res.headersSent) next(err);
  }
}

/**
 * POST /api/deploy/:id/deploy-signed
 * Body: { encodedTx: string }  (base-64 of signed deploy transaction)
 */
export async function deploySignedTx(
  req: Request<{ id: string }, unknown, { encodedTx: string }>,
  res: Response,
  next: NextFunction,
) {
  const { id }        = req.params;          // project UUID
  const { encodedTx } = req.body;
  const userId        = (req.user as { id?: string } | undefined)?.id;

  if (!userId)        return next(new AppError('User not found', 400));
  if (!encodedTx)     return next(new AppError('encodedTx missing', 400));

  try {
    const sig = await broadcastSignedTx(id, encodedTx);
    res.status(200).json({ ok: true, sig });
    return;
  } catch (err) {
    console.error('[deploySignedTx] relay failed:', err);
    return next(new AppError((err as Error).message, 500));
  }
}

/**
 * Creates a program deploy transaction that only requires the wallet to sign
 * Uses the BPF Upgradeable Loader which allows for program upgrades
 */
function createUpgradeableProgramDeployInstructions(
  programData: Buffer,
  payer: PublicKey,
  programId: PublicKey
): TransactionInstruction[] {
  // Constants for buffer account
  const dataLen = programData.length;
  const chunkSize = 900; // Standard chunk size for Solana
  
  // Calculate program derived buffer address
  const [bufferAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("buffer_seed")],
    BPF_LOADER_UPGRADEABLE_PROGRAM_ID
  );
  
  const instructions: TransactionInstruction[] = [];
  
  // 1. Create the buffer account - only requires payer to sign
  instructions.push(
    new TransactionInstruction({
      programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true }, // fee payer
        { pubkey: bufferAddress, isSigner: false, isWritable: true }, // buffer
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system program
      ],
      data: Buffer.concat([
        Buffer.from([0]), // CreateBuffer instruction
        // len as u32 LE
        Buffer.from(new Uint32Array([dataLen]).buffer),
      ]),
    })
  );
  
  // 2. Write program data to the buffer in chunks
  for (let offset = 0; offset < programData.length; offset += chunkSize) {
    const chunk = programData.slice(offset, offset + chunkSize);
    instructions.push(
      new TransactionInstruction({
        programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
        keys: [
          { pubkey: bufferAddress, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: false },
        ],
        data: Buffer.concat([
          Buffer.from([1]), // Write instruction
          // offset as u32 LE
          Buffer.from(new Uint32Array([offset]).buffer),
          chunk,
        ]),
      })
    );
  }
  
  // 3. Deploy the program from buffer
  instructions.push(
    new TransactionInstruction({
      programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true }, // payer 
        { pubkey: bufferAddress, isSigner: false, isWritable: true }, // buffer
        { pubkey: programId, isSigner: false, isWritable: true }, // program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system program
        { pubkey: BPF_LOADER_UPGRADEABLE_PROGRAM_ID, isSigner: false, isWritable: false }, // BPF Loader Upgradeable Program
      ],
      data: Buffer.from([2]), // DeployWithMaxDataLen instruction
    })
  );
  
  return instructions;
}

/**
 * POST /api/deploy/:id/prepare-deploy-tx
 * Prepares a deploy transaction for client-side signing
 */
export async function prepareDeployTx(
  req: Request<{ id: string }, unknown, { graph: Graph }>,
  res: Response,
  next: NextFunction
) {
  const { id } = req.params;
  const { graph } = req.body;
  const userId = (req.user as { id?: string } | undefined)?.id;

  console.log(`[API] Prepare deploy tx called for project: ${id}, userId: ${userId}`);

  if (!userId) return next(new AppError('User not found', 400));

  try {
    // Get the container information
    const containerName = await getContainerName(id);
    if (!containerName) {
      return next(new AppError('No container found for this project', 404));
    }

    // Get project path
    const rootPath = await getProjectRootPath(id);
    const BUILD_DIR = path.join('/tmp', `build-${id}`);
    
    // Create temp directory if it doesn't exist
    await fs.promises.mkdir(BUILD_DIR, { recursive: true });
    
    // Extract the program.so file from the container
    try {
      // 1. Locate the .so in the container
      const findCmd = `docker exec ${containerName} bash -c 'cd "/usr/src/${rootPath}" && SO_DIR="\${CARGO_TARGET_DIR:-target}/deploy" && find "$SO_DIR" -maxdepth 1 -name "*.so" | head -n 1'`;      
      console.log(`[API] Finding program binary with command: ${findCmd}`);
      const soPath = require('child_process').execSync(findCmd, { encoding: 'utf8' }).trim();
      
      if (!soPath) {
        return next(new AppError('Program binary not found in container', 500));
      }
      
      // 2. Copy it out safely with docker cp
      const hostSo = path.join(BUILD_DIR, 'program.so');
      const cpCmd = `docker cp ${containerName}:${soPath} ${hostSo}`;
      
      console.log(`[API] Copying program binary with command: ${cpCmd}`);
      require('child_process').execSync(cpCmd);
      
    } catch (err) {
      return next(new AppError(`Failed to extract program binary: ${(err as Error).message}`, 500));
    }
    
    // Check if file exists and has content
    try {
      const stats = await fs.promises.stat(path.join(BUILD_DIR, 'program.so'));
      if (stats.size === 0) {
        return next(new AppError('Program binary is empty. Build may have failed.', 500));
      }
    } catch (err) {
      return next(new AppError(`Program binary not found: ${(err as Error).message}`, 500));
    }
    
    // Read the program binary
    const programData = await fs.promises.readFile(path.join(BUILD_DIR, 'program.so'));
    console.log(`[API] Read program binary: ${programData.length} bytes`);
    
    // Create a Solana connection
    const conn = new Connection("https://api.devnet.solana.com", "recent");
    
    // Generate a deterministic program ID derived from the project ID
    // This allows frontend to know the program ID in advance
    const programId = deriveProgramId(id);
    
    // This will be replaced by the frontend with the actual user's wallet
    // We use a placeholder here just to build the transaction
    const placeholderWallet = Keypair.generate();
    
    // Create a transaction with instructions that only require the wallet to sign
    const tx = new Transaction();
    
    // Add the program deployment instructions
    const deployInstructions = createUpgradeableProgramDeployInstructions(
      programData,
      placeholderWallet.publicKey,
      programId
    );
    
    // Add all instructions to the transaction
    for (const instruction of deployInstructions) {
      tx.add(instruction);
    }
    
    // Get recent blockhash
    const { blockhash } = await conn.getLatestBlockhash("finalized");
    tx.recentBlockhash = blockhash;
    
    // Set the fee payer - this will be replaced by the frontend with the wallet's public key
    tx.feePayer = placeholderWallet.publicKey;
    
    // Serialize transaction to base64
    const serializedTx = tx.serialize({ requireAllSignatures: false }).toString("base64");
    
    // Return the transaction for client-side signing
    res.status(200).json({
      success: true,
      encodedTx: serializedTx,
      programId: programId.toBase58(),
      message: 'Transaction prepared for signing'
    });
  } catch (err) {
    console.error('[API] Error preparing deploy transaction:', err);
    return next(new AppError(`Failed to prepare deploy transaction: ${(err as Error).message}`, 500));
  }
}
