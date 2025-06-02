import { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { runDeployPipeline } from '../utils/deploy/runDeployPipeline';
import { Graph } from '../types/graph'; 
import { broadcastSignedTx } from '../utils/projectUtils';
import {
  Connection, Transaction, SystemProgram, Keypair, PublicKey,
  BPF_LOADER_PROGRAM_ID, TransactionInstruction
} from "@solana/web3.js";
import fs from 'fs';
import path from 'path';
import { getProjectRootPath } from '../utils/fileUtils';
import { getContainerName } from '../utils/projectUtils';

/**
 * POST /api/deploy/:id/deploy-pipeline
 * Streams Server-Sent Events while the build/deploy pipeline runs.
 */
export async function deployPipeline(
  req: Request<{ id: string }, unknown, { graph: Graph }>, // ← TYPED generics :contentReference[oaicite:0]{index=0}
  res: Response,
  next: NextFunction,
) {
  const { id }    = req.params;
  const { graph } = req.body;
  const userId    = (req.user as { id?: string } | undefined)?.id; // keep optional-chaining safe

  console.log(`[API] Deploy pipeline called for project: ${id}, userId: ${userId}`);
  console.log(`[API] Graph data received:`, JSON.stringify(graph).substring(0, 200) + '…');

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
    await runDeployPipeline({ projectId: id, userId, graph, sendProgress: send });

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
 * Creates instructions to load a program into a buffer account
 */
function createBPFLoaderWriteInstructions(
  data: Buffer,
  offset: number,
  bufferKey: PublicKey,
  payerKey: PublicKey
): TransactionInstruction[] {
  const chunkSize = 800;
  const instructions: TransactionInstruction[] = [];

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: bufferKey, isSigner: false, isWritable: true },
      ],
      programId: BPF_LOADER_PROGRAM_ID,
      data: Buffer.concat([
        Buffer.from([0]), // Write instruction
        Buffer.alloc(4).fill(new Uint8Array(new Uint32Array([offset + i]).buffer)),
        chunk,
      ]),
    });
    instructions.push(instruction);
  }

  return instructions;
}

/**
 * Creates instruction to finalize the program
 */
function createBPFLoaderFinalizeInstruction(
  bufferKey: PublicKey,
  payerKey: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: bufferKey, isSigner: false, isWritable: true },
      { pubkey: payerKey, isSigner: true, isWritable: false },
    ],
    programId: BPF_LOADER_PROGRAM_ID,
    data: Buffer.from([1]), // Finalize instruction
  });
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
    const copyCmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && SO_DIR=\\"\${CARGO_TARGET_DIR:-target}/deploy\\" && find \\"$SO_DIR\\" -maxdepth 1 -name '*.so' | head -n 1 | xargs -I{} cat {}" > ${BUILD_DIR}/program.so`;
    
    try {
      await new Promise<void>((resolve, reject) => {
        require('child_process').exec(copyCmd, (error: Error | null) => {
          if (error) reject(error);
          else resolve();
        });
      });
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
    
    // Create keypairs for transaction
    const payer = Keypair.generate(); // This will be replaced by the user's wallet
    const buffer = Keypair.generate(); // Buffer account to hold the program
    
    // Calculate required lamports for rent exemption
    const lamports = await conn.getMinimumBalanceForRentExemption(programData.length);
    
    // Create transaction
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: buffer.publicKey,
        lamports,
        space: programData.length,
        programId: BPF_LOADER_PROGRAM_ID,
      })
    );
    
    // Add write instructions for the program data
    const writeInstructions = createBPFLoaderWriteInstructions(
      programData, 
      0, 
      buffer.publicKey, 
      payer.publicKey
    );
    
    // Add all write instructions to the transaction
    for (const instruction of writeInstructions) {
      tx.add(instruction);
    }
    
    // Add finalize instruction
    tx.add(createBPFLoaderFinalizeInstruction(
      buffer.publicKey,
      payer.publicKey
    ));
    
    // Get recent blockhash
    const { blockhash } = await conn.getLatestBlockhash("finalized");
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    
    // Serialize transaction to base64
    const encodedTx = tx.serialize({ verifySignatures: false }).toString("base64");
    
    // Return the transaction for client-side signing
    res.status(200).json({
      success: true,
      encodedTx,
      programId: buffer.publicKey.toBase58(),
      message: 'Transaction prepared for signing'
    });
  } catch (err) {
    console.error('[API] Error preparing deploy transaction:', err);
    return next(new AppError(`Failed to prepare deploy transaction: ${(err as Error).message}`, 500));
  }
}
