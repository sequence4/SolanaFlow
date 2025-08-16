import { PublicKey } from '@solana/web3.js';
import { createHash } from 'crypto';

/**
 * Solana's built‑in upgradeable loader program.
 * This constant matches the server-side logic used during code generation.
 */
const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  'BPFLoaderUpgradeab1e11111111111111111111111',
);

/**
 * Deterministically derive a program ID from a project UUID.
 * The project ID (a UUID string) is hashed with SHA‑256 and combined
 * with the string "program" as seeds for a PDA under the upgradeable loader.
 *
 * @param projectId – the unique ID of the project
 * @returns a PublicKey corresponding to the derived program account
 */
export function deriveProgramId(projectId: string): PublicKey {
  // Hash the project ID to 32 bytes; this fits the PDA seed length requirement.
  const uuidHash = createHash('sha256').update(projectId).digest();
  // Compute the PDA for ["program", uuidHash] using the upgradeable loader ID.
  return PublicKey.findProgramAddressSync(
    [Buffer.from('program'), uuidHash],
    BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  )[0];
} 