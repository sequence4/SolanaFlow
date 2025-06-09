import { Connection, clusterApiUrl } from "@solana/web3.js";

/**
 * Shared connection to public Solana devnet RPC.
 * This avoids API key issues and matches Solana Playground's approach.
 */
export const connection = new Connection(
  process.env.NEXT_PUBLIC_SOL_RPC ??
   // 'https://api.devnet.solana.com',   // fallback if env missing
   'https://tiniest-smart-putty.solana-devnet.quiknode.pro/31fdf5493679b4c1c854289d95c822094900efc2/',
  'confirmed'
);

/**  
 * Milliseconds to wait between tx sends to match Solana Playground throughput
 */
export const RATE_LIMIT_MS = 70;         // ≈14 tx/sec (under QN limit)