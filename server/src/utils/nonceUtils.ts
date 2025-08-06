import {
  Connection,
  PublicKey,
  SystemProgram,
  NONCE_ACCOUNT_LENGTH,
} from '@solana/web3.js';

/**
 * Ensure a nonce‑account exists whose authority is `authorizedPubkey`.
 * If none is found **we no longer create it on the server** –  
 * the caller's wallet must create & fund the account itself.
 *
 * Returns `{ noncePubkey, nonceHash }`.
 */
export async function ensureNonceAccount(
  connection: Connection,
  authorizedPubkey: PublicKey,
): Promise<{ noncePubkey: PublicKey; nonceHash: string }> {
  /* 1️⃣ look for any existing nonce‑account owned by `authorizedPubkey` */
  const nonceAccts = await connection.getProgramAccounts(SystemProgram.programId, {
    filters: [
      { dataSize: NONCE_ACCOUNT_LENGTH },
      {
        memcmp: {
          /** Authority pubkey lives in bytes 8‑40 of the nonce account
           *  (see Solana Stack Exchange answer) */
          offset: 8,
          bytes: authorizedPubkey.toBase58(),
        },
      },
    ],
  });

  if (!nonceAccts.length) {
    throw new Error(
      'No durable‑nonce account found for this wallet (please create & fund one).',
    );
  }

  const noncePubkey = nonceAccts[0].pubkey;

  /* 3️⃣ fetch current hash stored in the nonce account */
  const nonceAccount = await connection.getNonce(noncePubkey, 'confirmed');
  return { noncePubkey, nonceHash: nonceAccount?.nonce.toString() ?? '' };
}