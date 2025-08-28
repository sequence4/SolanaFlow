import express, { Request, Response } from 'express';
import { Keypair } from '@solana/web3.js';
import { catchAsync } from '../utils/middleware/catchAsync';
import { storeProjectEphemeralKey } from '../utils/ephemeralKeyStore';

const router = express.Router();

// POST /projects/:projectId/ephemeral
// · If the client sends {pubkey}, just record it.
// · If the body is empty, generate a fresh keypair and return its pubkey.
router.post(
  '/:projectId/ephemeral',
  catchAsync(async (req: Request, res: Response) => {
    let { pubkey } = req.body as { pubkey?: string };

    if (!pubkey) {
      const kp = Keypair.generate();               // secret stays on server
      pubkey = kp.publicKey.toBase58();
      // Store the keypair for later use by relayTx
      storeProjectEphemeralKey(req.params.projectId, kp);
      console.log(
        `[EPHEMERAL] Generated new ephemeral keypair: ${pubkey} ` +
          `for project ${req.params.projectId}`
      );
    } else {
      console.log(
        `[EPHEMERAL] received buffer pubkey ${pubkey} for project ${req.params.projectId}`
      );
    }

    res.json({ ephemeralPubkey: pubkey });
  })
);

export default router; 