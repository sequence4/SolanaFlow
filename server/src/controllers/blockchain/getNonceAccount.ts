import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { ensureNonceAccount } from "../../utils/blockchain/nonceUtils";
import { Keypair } from "@solana/web3.js";
import { NONCE_ACCOUNT_LENGTH } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";

/**
 * POST /projects/:id/nonce
 *
 * Creates (or retrieves) a durable nonce account controlled by the caller's
 * wallet (fee‑payer = server).  Returns `{ noncePubkey, nonceHash }`.
 */
export const getNonceAccount = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id: projectId } = req.params;
      const { walletPubkey } = req.body;
  
      if (!walletPubkey) {
        return next(new AppError('walletPubkey required', 400));
      }
  
  
      const connection = new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        'confirmed',
      );
  
      let noncePubkey: PublicKey;
      let nonceHash: string;
      try {
        ({ noncePubkey, nonceHash } = await ensureNonceAccount(
          connection,
          new PublicKey(walletPubkey),
        ));
        res.json({
          noncePubkey: noncePubkey.toBase58(),
          nonceHash,
        });
        return;
      } catch (e) {
        const wallet = new PublicKey(walletPubkey);
        const nonceKp = Keypair.generate();
        const lamports = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  
        const createIx = SystemProgram.createAccount({
          fromPubkey: wallet,
          newAccountPubkey: nonceKp.publicKey,
          lamports,
          space: NONCE_ACCOUNT_LENGTH,
          programId: SystemProgram.programId,
        });
  
        const initIx = SystemProgram.nonceInitialize({
          noncePubkey: nonceKp.publicKey,
          authorizedPubkey: wallet,
        });
  
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        const tx = new Transaction({ feePayer: wallet, recentBlockhash: blockhash })
          .add(createIx, initIx);
        tx.partialSign(nonceKp);
        const txBase64 = tx.serialize({ requireAllSignatures: false }).toString('base64');
  
        res.status(409).json({
          code: 'WALLET_SIGNATURE_REQUIRED',
          reason: 'CREATE_NONCE',
          noncePubkey: nonceKp.publicKey.toBase58(),
          txBase64,
          txForWallet: txBase64,
          missing: [wallet.toBase58()],
        });
        return;
      }
    } catch (err) {
      next(err);
    }
  };