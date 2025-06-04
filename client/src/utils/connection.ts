import { Connection } from "@solana/web3.js";

/**
 * Shared connection to Helius Devnet RPC endpoint
 * Note: For production/mainnet, use a private (non-NEXT_PUBLIC_) env var
 * and proxy requests through a server endpoint to protect your API key
 */
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC;
if (!rpcUrl) {
  throw new Error("❌  NEXT_PUBLIC_SOLANA_RPC env var not defined");
}
export const connection = new Connection(rpcUrl, "confirmed"); 