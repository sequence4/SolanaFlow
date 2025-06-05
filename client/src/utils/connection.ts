import { Connection, clusterApiUrl } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

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
export const NONCE_PUBKEY = new PublicKey(
  process.env.NEXT_PUBLIC_DEPLOY_NONCE!
); 