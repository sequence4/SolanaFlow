import { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { runDeployPipeline } from '../utils/deploy/runDeployPipeline';
import { Graph } from '../types/graph'; 
import { deriveProgramId } from "../utils/deriveProgramId";
import { markContainerForCleanup } from "../utils/container/cleanupQueue";

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
    return next(new AppError('Graph must include at least one node', 400)); 
  }

  /* ------------------------------------------------------------------ *
   * Setup Server-Sent Events response
   * ------------------------------------------------------------------ */
  res.writeHead(200, {
    'Content-Type': 'text/event-stream', // official MIME type for SSE
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Generic helper keeps TypeScript happy for every event payload
  const send = <T = unknown>(data: T): void => {
    console.log('[API] Sending SSE event:', data);
    // Allow custom SSE event names (MDN pattern)
    // https://developer.mozilla.org/... → custom events
    if (typeof data === 'object' && data && 'event' in data) {
      const { event, ...payload } = data as any;
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
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
