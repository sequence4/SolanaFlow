import express, { Request, Response } from 'express';
import { signDeployTxAndBroadcast } from '../utils/blockchain/signDeployTxAndBroadcast';
import { catchAsync } from '../utils/middleware/catchAsync';

const router = express.Router();

// POST /projects/:projectId/relayDeployTx  { encodedTx, programId }
router.post('/:projectId/relayDeployTx', catchAsync(async (req: Request, res: Response) => {
  const { encodedTx, programId } = req.body as { encodedTx?: string; programId?: string };
  if (!encodedTx || !programId) {
    return res
      .status(400)
      .json({ error: 'encodedTx and programId required' });
  }

  try {
    const out = await signDeployTxAndBroadcast(
      req.params.projectId,
      encodedTx,
      programId,
    );
    if (out?.txForWallet) {
      return res.status(409).json({
        code: 'WALLET_SIGNATURE_REQUIRED',
        missing: out.missing ?? [],
        txBase64: out.txForWallet,
      });
    }
    res.json({ signature: out.signature });
  } catch (e: any) {
    console.error('[relayDeployTx] failed', e);
    res.status(500).json({ error: e.message });
  }
}));

export default router; 