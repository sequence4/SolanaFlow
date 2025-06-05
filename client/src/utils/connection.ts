import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";

/**
 * Shared connection to public Solana devnet RPC.
 * This avoids API key issues and matches Solana Playground's approach.
 */
export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

/**  
 * Milliseconds to wait between tx sends to match Solana Playground throughput
 */
export const RATE_LIMIT_MS = 14; 

// Public durable-nonce account used by the browser deployer.
// ⚠️  Set in .env so we can reuse the same build on devnet/localnet.
// example: NEXT_PUBLIC_DEPLOY_NONCE=8obBFzM8hT8QfbeXEBd1nigszcsqP9taR4uadY4voZx2
const noncePubkeyStr = process.env.NEXT_PUBLIC_DEPLOY_NONCE;
if (!noncePubkeyStr) {
  /**
   * NEXT_PUBLIC_DEPLOY_NONCE is missing.
   * 1.  Create the account:  
   *     solana-keygen new -o deploy-nonce.json
   *     solana create-nonce-account deploy-nonce.json 0.1 --nonce-authority <YOUR_WALLET_PUBKEY>
   * 2.  Add the public key to `.env.local`:  
   *     NEXT_PUBLIC_DEPLOY_NONCE=<NONCE_PUBLIC_KEY>
   * 3.  **Restart** `pnpm dev` so Next.js picks it up.
   */
  throw new Error(
    "Environment variable NEXT_PUBLIC_DEPLOY_NONCE is not set. " +
    "Add it to .env.local and restart the dev server."
  );
}

export const NONCE_PUBKEY = new PublicKey(noncePubkeyStr); 