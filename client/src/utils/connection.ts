import { Connection, clusterApiUrl } from "@solana/web3.js";

/**
 * Shared connection to public Solana devnet RPC.
 * This avoids API key issues and matches Solana Playground's approach.
 */
export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

/**  
 * Milliseconds to wait between tx sends to match Solana Playground throughput
 */
export const RATE_LIMIT_MS = 14; 