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
  const { id } = req.params;
  const { graph, walletSigned: requestWalletSigned } = req.body;
  const { devMode } = req.body as { devMode?: boolean };
  const userId = (req.user as { id?: string } | undefined)?.id; // keep optional-chaining safe
  const walletSigned = requestWalletSigned === true;

  console.log(`[DEPLOY] Starting deployment pipeline for project: ${id}`);
  console.log(`[DEPLOY] Wallet-signed deployment: ${walletSigned ? 'Yes' : 'No'}`);

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
  /**
   * Stream an SSE event **and** log a compact version to the server console.
   * Large binary blobs (e.g. the base‑64 .so artefact) are replaced with a
   * short placeholder so the console stays readable.
   */
  const send = <T = unknown>(data: T): void => {
    // Clean up the data for logging
    let safeForLog: unknown;
    
    // Handle different types of data for cleaner logs
    if (typeof data === 'object' && data !== null) {
      const clone = { ...(data as any) };
      
      // Handle artifacts (compiled programs)
      if ('artifact' in clone && typeof clone.artifact === 'string') {
        clone.artifact = `<${clone.artifact.length}B compiled program>`;
      }
      
      // Handle file trees
      if ('fileTree' in clone && Array.isArray(clone.fileTree)) {
        clone.fileTree = `<file tree with ${clone.fileTree.length} root items>`;
      }
      
      // Handle IDLs
      if ('idl' in clone) {
        clone.idl = '<IDL data>';
      }
      if ('idls' in clone && Array.isArray(clone.idls)) {
        clone.idls = `<${clone.idls.length} IDLs>`;
      }
      
      // Handle content in file-written events
      if ('content' in clone && typeof clone.content === 'string') {
        clone.content = `<${clone.content.length}B content>`;
      }
      
      safeForLog = clone;
    } else {
      safeForLog = data;
    }

    // Log a clean, human-readable version of the event
    if (typeof data === 'object' && data !== null) {
      const eventObj = data as any;
      if (eventObj.stage && eventObj.message) {
        console.log(`[SSE] ${eventObj.stage}: ${eventObj.message}`);
      } else if (eventObj.stage) {
        console.log(`[SSE] ${eventObj.stage}`);
      } else if (eventObj.event) {
        console.log(`[SSE] Event: ${eventObj.event}`);
      } else {
        console.log('[SSE] Sending event:', safeForLog);
      }
    } else {
      console.log('[SSE] Sending event:', safeForLog);
    }
    
    // Allow custom SSE event names (MDN pattern)
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
      walletSigned,
      devMode: !!devMode
    });

    // let the client know we're done, then close the SSE stream
    send({ stage: 'completed', message: 'Pipeline finished' });
    console.log(`[DEPLOY] Pipeline completed successfully for project: ${id}`);
    res.end();
  } catch (err) {
    const errorMessage = (err as Error).message;
    console.error(`[DEPLOY] Pipeline failed: ${errorMessage}`);
    send({ stage: 'error', message: errorMessage });
    res.end();
    if (!res.headersSent) next(err);
  }
}
