import express, { Request, Response } from 'express';
const router = express.Router();

// POST /projects/:id/ephemeral  { pubkey }
router.post('/:projectId/ephemeral', async (req: Request, res: Response) => {
  const { pubkey } = req.body as { pubkey?: string };
  if (!pubkey) return res.status(400).json({ error: 'missing pubkey' });

  // TODO: persist pubkey per‑project if you need it later
  console.log(`[EPHEMERAL] received buffer pubkey ${pubkey} for project ${req.params.projectId}`);
  res.json({ status: 'ok' });
});

export default router; 