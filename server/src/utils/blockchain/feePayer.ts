import { Keypair } from '@solana/web3.js';

/**
 * Ensures a server fee‑payer keypair is available and returns it.
 * Priority:
 *   ① `SERVER_FEE_PAYER` env (JSON array of 64 ints)
 *   ② Generate → return (no local persistence)
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

  /* ② GENERATE --------------------------------------------------------- */
  const kp = Keypair.generate();
  console.log(
    '[FEE_PAYER] Generated new ephemeral fee payer. ' +
    'Set SERVER_FEE_PAYER env var with the keypair JSON for persistence.',
  );
  return kp;
}