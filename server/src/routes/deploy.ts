import express from 'express';
import { signDeployTxAndBroadcast } from '../utils/projectUtils';

const router = express.Router();

// POST /projects/:id/relayDeployTx  { encodedTx, programId }
router.post('/:projectId/relayDeployTx', async (req, res) => {
  const { encodedTx, programId } = req.body as { encodedTx?: string; programId?: string };
  if (!encodedTx || !programId) {
    return res.status(400).json({ error: 'encodedTx and programId required' });
  }
  try {
    const sig = await signDeployTxAndBroadcast(req.params.projectId, encodedTx, programId);
    res.json({ signature: sig });
  } catch (e: any) {
    console.error('[relayDeployTx] failed', e);
    res.status(500).json({ error: e.message });
  }
});

export default router; 