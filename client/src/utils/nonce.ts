import {
  Connection,
  Keypair,
  NONCE_ACCOUNT_LENGTH,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";

/**
 * Returns a durable-nonce account pubkey, creating and funding one the
 * first time this function is called for the current browser.
 *
 * On devnet we airdrop rent if balance is low (< 0.1 SOL).
 * The pubkey is cached in localStorage under "durableNonce".
 */
export async function ensureDurableNonce(
  connection: Connection,
  wallet: WalletContextState
): Promise<PublicKey> {
  // 1️⃣ cached?
  const cached = typeof window !== "undefined"
    ? localStorage.getItem("durableNonce")
    : null;
  if (cached) return new PublicKey(cached);

  // 2️⃣ generate keypair for the nonce account
  const nonceKP = Keypair.generate();

  // 3️⃣ calculate rent-exempt lamports (≈0.1 SOL on devnet)
  const rent = await connection.getMinimumBalanceForRentExemption(
    NONCE_ACCOUNT_LENGTH
  );

  // 4️⃣ optional: devnet airdrop if wallet empty (< rent + fees)
  const balance = await connection.getBalance(wallet.publicKey!);
  if (balance < rent + 1e7) {                      // 0.01 SOL buffer
    try { await connection.requestAirdrop(wallet.publicKey!, 2e9); } catch {}
  }

  // 5️⃣ build & send createNonceAccount tx
  const createIx = SystemProgram.createNonceAccount({
    fromPubkey: wallet.publicKey!,
    noncePubkey: nonceKP.publicKey,
    authorizedPubkey: wallet.publicKey!,
    lamports: rent,
  });
  const tx = new Transaction().add(createIx);
  tx.feePayer = wallet.publicKey!;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.partialSign(nonceKP);
  const signed = await wallet.signTransaction!(tx);

  // 🚀 fire the tx
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
  });

  // 🕒 1️⃣ wait for confirmation (commitment "confirmed")
  await connection.confirmTransaction(sig, "confirmed");

  // 🕒 2️⃣ poll until RPC returns a populated nonce (max 20 × 250 ms)
  for (let i = 0; i < 20; i++) {
    const info = await connection.getNonce(nonceKP.publicKey, "confirmed");
    if (info?.nonce) break;
    await new Promise((r) => setTimeout(r, 250));
    if (i === 19)
      throw new Error("Nonce account initialisation timed out after 5 s");
  }

  // 6️⃣ persist for next sessions
  if (typeof window !== "undefined") {
    localStorage.setItem("durableNonce", nonceKP.publicKey.toBase58());
  }

  return nonceKP.publicKey;
} 