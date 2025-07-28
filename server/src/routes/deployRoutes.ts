import express, { Request, Response, NextFunction } from 'express';
import { signDeployTxAndBroadcast } from '../utils/projectUtils';
import { catchAsync } from '../utils/catchAsync';
import { deployPipeline } from '../controllers/deployController';
import { authMiddleware } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * DEV_AUTH: Temporary middleware to attach a synthetic user ID to requests.
 * This is only for development/testing; replace with authMiddleware once ready.
 */
const DEV_AUTH = (req: any, _res: any, next: NextFunction): void => {
  // Provide a deterministic UUID so downstream DB inserts succeed.
  req.user = { id: '00000000-0000-0000-0000-000000000000' };
  // Alternatively, generate a random ID each time: req.user = { id: uuidv4() };
  next();
};

// Flip this back to authMiddleware for production use.
const guard = DEV_AUTH;

// POST /api/deploy/:id/deploy-pipeline
router.post('/:id/deploy-pipeline', guard, deployPipeline);

// POST /projects/:projectId/relayDeployTx  { encodedTx, programId }
router.post('/:projectId/relayDeployTx', catchAsync(async (req: Request, res: Response) => {
  const { encodedTx, programId } = req.body as { encodedTx?: string; programId?: string };
  
  console.log(`[RELAY_DEPLOY_TX] Received request for project ${req.params.projectId}`);
  console.log(`[RELAY_DEPLOY_TX] Program ID: ${programId}`);
  console.log(`[RELAY_DEPLOY_TX] Encoded TX length: ${encodedTx?.length || 0} characters`);
  
  if (!encodedTx || !programId) {
    console.log('[RELAY_DEPLOY_TX] Missing required parameters');
    return res.status(400).json({ error: 'encodedTx and programId required' });
  }
  
  try {
    console.log(`[RELAY_DEPLOY_TX] Calling signDeployTxAndBroadcast for project ${req.params.projectId}`);
    const sig = await signDeployTxAndBroadcast(
      req.params.projectId,
      encodedTx,
      programId,
    );
    console.log(`[RELAY_DEPLOY_TX] Transaction signed and broadcast successfully, signature: ${sig}`);
    res.json({ signature: sig });
  } catch (e: any) {
    console.error('[relayDeployTx] failed', e);
    res.status(500).json({ error: e.message });
  }
}));

export default router; 