import { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { runDeployPipeline } from '../utils/deploy/runDeployPipeline';
import { Graph } from '../types/graph'; 
import { broadcastSignedTx } from '../utils/projectUtils';

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
 * POST /api/build/:id/prepare-deploy-tx
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
    // This is a placeholder for the actual transaction building logic
    // In a real implementation, you would:
    // 1. Get the compiled program binary
    // 2. Create a deploy transaction with the correct instructions
    // 3. Return the serialized transaction

    // For now, we'll just return a mock response
    res.status(200).json({
      success: true,
      encodedTx: 'BASE64_ENCODED_TRANSACTION_PLACEHOLDER',
      message: 'Transaction prepared for signing'
    });
  } catch (err) {
    console.error('[API] Error preparing deploy transaction:', err);
    return next(new AppError(`Failed to prepare deploy transaction: ${(err as Error).message}`, 500));
  }
}
