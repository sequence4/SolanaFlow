import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import pool from '@/config/database';
import { encrypt } from '@/utils/crypto';
import { Provider } from '@/utils/modelProviderMap';

const router = express.Router();

// Controller functions
const listUserApiKeys = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rows } = await pool.query(
      'SELECT provider FROM user_api_keys WHERE user_id = $1',
      [req.user!.id]
    );
    res.json(rows.map(r => r.provider));
  } catch (e) {
    next(e);
  }
};

const upsertApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const provider = req.params.provider as Provider;
    if (!req.body.apiKey) {
      res.status(400).json({ error: 'apiKey required' });
      return;
    }
    
    const cipher = encrypt(req.body.apiKey);
    await pool.query(
      `INSERT INTO user_api_keys (user_id, provider, key_cipher)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id,provider)
       DO UPDATE SET key_cipher = EXCLUDED.key_cipher`,
      [req.user!.id, provider, cipher]
    );
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
};

// Routes
router.get('/', listUserApiKeys as RequestHandler);
router.put('/:provider', upsertApiKey as RequestHandler);

export default router; 