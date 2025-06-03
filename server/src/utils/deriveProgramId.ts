import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

/** Solana's built-in upgradeable loader program ID */
export const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);

/**
 * Deterministically derive a program ID for a given project UUID,
 * staying within the 32-byte seed limit.
 */
export function deriveProgramId(projectId: string): PublicKey {
  // SHA-256 → 32 bytes → safe for PDA seeds
  const uuidHash = createHash("sha256").update(projectId).digest(); // 32 bytes
  return PublicKey.findProgramAddressSync(
    [Buffer.from("program"), uuidHash],
    BPF_LOADER_UPGRADEABLE_PROGRAM_ID
  )[0];
} 