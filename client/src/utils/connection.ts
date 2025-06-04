import { Connection } from "@solana/web3.js";

/**
 * Shared connection to Helius Dev-net RPC.
 * NOTE: the key is public because all requests are made client-side.
 *       Swap to a server-side proxy (no NEXT_PUBLIC_ prefix) for main-net.
 *       Helius Developer tier → 5 TPS soft limit.
 */
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC;
if (!RPC_URL) throw new Error("❌  NEXT_PUBLIC_SOLANA_RPC is missing");

/**  
 * Milliseconds to wait between tx sends so we stay < 5 TPS  
 * 1000 / (1000 / RATE_LIMIT_MS) ≈ 2.8 TPS – plenty of head-room.
 */
export const RATE_LIMIT_MS = 350;

export const connection = new Connection(RPC_URL, "confirmed"); 