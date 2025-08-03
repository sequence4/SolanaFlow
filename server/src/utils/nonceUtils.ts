import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  NONCE_ACCOUNT_LENGTH,
} from '@solana/web3.js';

/**
 * Ensure a nonce‑account exists whose authority is `authorizedPubkey`.
 * If none is found, create one funded by `feePayer`.
 *
 * Returns `{ noncePubkey, nonceHash }`.
 */
export async function ensureNonceAccount(
  connection: Connection,
  authorizedPubkey: PublicKey,
  feePayer: Keypair,
): Promise<{ noncePubkey: PublicKey; nonceHash: string }> {
  /* 1️⃣ look for any existing nonce‑account owned by `authorizedPubkey` */
  const nonceAccts = await connection.getProgramAccounts(SystemProgram.programId, {
    filters: [
      { dataSize: NONCE_ACCOUNT_LENGTH },
      {
        memcmp: {
          /** authorised‑pubkey starts at offset 4 */
          offset: 4,
          bytes: authorizedPubkey.toBase58(),
        },
      },
    ],
  });

  let noncePubkey: PublicKey;

  if (nonceAccts.length) {
    noncePubkey = nonceAccts[0].pubkey;
  } else {
    /* 2️⃣ create a brand‑new nonce account */
    const nonceKp = Keypair.generate();
    noncePubkey = nonceKp.publicKey;

    const lamports = await connection.getMinimumBalanceForRentExemption(
      NONCE_ACCOUNT_LENGTH,
    );

    const tx = SystemProgram.createNonceAccount({
      fromPubkey: feePayer.publicKey,
      noncePubkey,
      authorizedPubkey,
      lamports,
    });

    await connection.sendTransaction(tx, [feePayer, nonceKp], {
      skipPreflight: true,
    });
  }

  /* 3️⃣ fetch current hash stored in the nonce account */
  const nonceAccount = await connection.getNonce(noncePubkey, 'confirmed');
  return { noncePubkey, nonceHash: nonceAccount?.nonce.toString() ?? '' };
}