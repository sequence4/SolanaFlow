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

  /* ───────── DEBUG FLAG ──────────────────────────────── *
   * Set DEBUG_NONCE=true in .env or shell to enable logs  */
  const DBG = process.env.DEBUG_NONCE === "true";

  if (DBG) {
    console.log(
      "[NONCE‑DBG] ensureNonceAccount – rpc:",
      (connection as any)._rpcEndpoint || (connection as any).rpcEndpoint,
      "wallet:",
      authorizedPubkey.toBase58(),
    );
  }

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

  if (DBG) {
    console.log(
      "[NONCE‑DBG] accounts len with dataSize=80 & offset=8:",
      nonceAccts.length,
    );
  }

  /* 2️⃣ optional retry: wait up to 5 × 400 ms for RPC lag */
  if (!nonceAccts.length) {
    for (let i = 0; i < 5 && !nonceAccts.length; i++) {
      await new Promise(r => setTimeout(r, 400));
      const again = await connection.getProgramAccounts(SystemProgram.programId, {
        filters: [
          { dataSize: NONCE_ACCOUNT_LENGTH },
          { memcmp: { offset: 8, bytes: authorizedPubkey.toBase58() } },
        ],
      });
      if (again.length) {
        if (DBG) console.log("[NONCE‑DBG] account appeared after retry", i + 1);
        // Use the found account instead of empty array
        return {
          noncePubkey: again[0].pubkey,
          nonceHash: (await connection.getNonce(again[0].pubkey, 'confirmed'))?.nonce.toString() ?? ''
        };
      }
    }
  }

  /* 3️⃣ if still none, probe other failure modes */
  if (!nonceAccts.length && DBG) {
    // a) check without the dataSize filter (size drift culprit)
    const anySize = await connection.getProgramAccounts(SystemProgram.programId, {
      filters: [{ memcmp: { offset: 8, bytes: authorizedPubkey.toBase58() } }],
    });
    console.log(
      "[NONCE‑DBG] len without dataSize filter:",
      anySize.length,
      "first dataLen:",
      anySize[0]?.account.data.length,
    );

    // b) log current slot and latest blockhash (rpc lag culprit)
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("processed");
    const slot = await connection.getSlot("processed");
    console.log(
      `[NONCE‑DBG] slot:${slot}, lastValidBlockHeight:${lastValidBlockHeight}, blockhash:${blockhash}`,
    );
  }

  if (!nonceAccts.length) {
    throw new Error(
      'No durable‑nonce account found for this wallet (please create & fund one).',
    );
  }

  const noncePubkey = nonceAccts[0].pubkey;

  /* 3️⃣ fetch current hash stored in the nonce account */
  const nonceAccount = await connection.getNonce(noncePubkey, 'confirmed');

  if (DBG) {
    console.log(
      "[NONCE‑DBG] using noncePubkey:",
      noncePubkey.toBase58(),
      "hash:",
      nonceAccount?.nonce.toString(),
    );
  }

  return { noncePubkey, nonceHash: nonceAccount?.nonce.toString() ?? '' };
}