import pool from '@/config/database';
import { decrypt } from '@/utils/crypto';
import { Provider } from '@/utils/modelProviderMap';
import { Request, Response, NextFunction } from 'express';

/** Map provider ⇒ decrypted key */
export type AIKeyBag = Record<Provider, string | undefined>;

/* ---------- Type augmentation ---------- */
declare global {
  namespace Express {
    interface Request {
      aiKeys?: AIKeyBag;
    }
  }
}

/* ---------- Middleware ---------- */
export async function attachApiKey(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id;          // assumes authMiddleware ran first
    if (!userId) return next();

    const { rows } = await pool.query(
      'SELECT provider, key_cipher FROM user_api_keys WHERE user_id = $1',
      [userId]
    );

    req.aiKeys = Object.fromEntries(
      rows.map((r: {provider: Provider; key_cipher: Buffer}) => [
        r.provider,
        decrypt(r.key_cipher)
      ])
    ) as AIKeyBag;

    next();
  } catch (err) {
    next(err);
  }
} 