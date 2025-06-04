import { Connection } from "@solana/web3.js";

export const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://devnet.helius-rpc.com/?api-key=623fd101-c0bd-4575-905b-cfeac8e9138c",
  "confirmed"
); 