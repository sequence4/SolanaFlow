import fs from 'fs';
import path from 'path';
import { Keypair } from '@solana/web3.js';
import { APP_CONFIG } from '../config/appConfig';

/**
 * Ensures a server fee‑payer keypair is available and returns it.
 * Priority:  
 *   ① `SERVER_FEE_PAYER` env (JSON array of 64 ints)  
 *   ② `<wallets>/server_fee_payer.json` persisted on disk  
 *   ③ Generate → persist → return
 */
export function getServerFeePayer(): Keypair {
  /* ① ENV -------------------------------------------------------------- */
  const env = process.env.SERVER_FEE_PAYER;
  if (env) {
    try {
      const arr = JSON.parse(env);
      if (Array.isArray(arr) && arr.length === 64) {
        return Keypair.fromSecretKey(Uint8Array.from(arr));
      }
      console.warn('[FEE_PAYER] SERVER_FEE_PAYER env has wrong shape – ignoring.');
    } catch {
      console.warn('[FEE_PAYER] SERVER_FEE_PAYER env JSON.parse failed – ignoring.');
    }
  }

  /* ② DISK ------------------------------------------------------------- */
  const walletsDir = APP_CONFIG.WALLETS_FOLDER;
  const filePath   = path.join(walletsDir, 'server_fee_payer.json');
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length === 64) {
        return Keypair.fromSecretKey(Uint8Array.from(arr));
      }
      console.warn('[FEE_PAYER] server_fee_payer.json invalid – will regenerate.');
    }
  } catch (e) {
    console.warn('[FEE_PAYER] Could not read server_fee_payer.json:', e);
  }

  /* ③ GENERATE --------------------------------------------------------- */
  const kp = Keypair.generate();
  try {
    fs.mkdirSync(walletsDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(Array.from(kp.secretKey)));
    console.log(
      `[FEE_PAYER] Generated new fee payer → ${filePath}. ` +
      'Copy its contents to the SERVER_FEE_PAYER env var for production.',
    );
  } catch (e) {
    console.warn('[FEE_PAYER] Failed to persist new fee payer key:', e);
  }
  return kp;
}