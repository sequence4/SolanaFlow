import { Keypair } from "@solana/web3.js";
import { AppError } from "../../middleware/errorHandler";
import { NextFunction, Request, Response } from "express";
import { storeProjectEphemeralKey } from "../../utils/ephemeralKeyStore";

export const createEphemeralKeypair = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
      
      const ephem = Keypair.generate();
      const pubkey = ephem.publicKey.toBase58();
      
      // Store the keypair for later use by relayTx
      storeProjectEphemeralKey(projectId, ephem);
      
      res.status(200).json({
        message: 'Ephemeral keypair created successfully',
        pubkey,
        ephemeralPubkey: pubkey
      });
    } catch (error) {
      console.error('Error creating ephemeral keypair:', error);
      next(new AppError('Failed to create ephemeral keypair', 500));
    }
  };