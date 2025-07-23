import express, { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';

const router = express.Router();

// POST /projects/:projectId/ephemeral  { pubkey }
router.post('/:projectId/ephemeral', catchAsync(async (req: Request, res: Response) => {
  const { pubkey } = req.body as { pubkey?: string };
  if (!pubkey) return res.status(400).json({ error: 'missing pubkey' });

  // TODO: persist pubkey per‑project if you need it later
  console.log(`[EPHEMERAL] received buffer pubkey ${pubkey} for project ${req.params.projectId}`);
  res.json({ status: 'ok' });
}));

export default router; 