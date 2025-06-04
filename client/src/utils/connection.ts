import { Connection } from "@solana/web3.js";

/**
 * Shared connection to Helius Devnet RPC endpoint
 * Note: For production/mainnet, use a private (non-NEXT_PUBLIC_) env var
 * and proxy requests through a server endpoint to protect your API key
 */
export const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://devnet.helius-rpc.com/?api-key=623fd101-c0bd-4575-905b-cfeac8e9138c",
  "confirmed"
); 