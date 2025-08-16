import { Keypair } from '@solana/web3.js';
import { createHash } from 'crypto';

/**
 * Derive a deterministic program keypair from a project ID.
 * This uses SHA-256 to hash the project ID and uses the first 32 bytes as the seed
 * for ed25519.  The resulting Keypair can be used to deploy a program with a
 * predictable programId.
 *
 * @param projectId - the project UUID
 * @returns a deterministic Keypair
 */
export function deriveProgramKeypair(projectId: string): Keypair {
  // Hash the projectId to 32 bytes via SHA-256.
  const hash = createHash('sha256').update(projectId).digest();
  // Use the first 32 bytes of the hash as the seed for the keypair.
  const seed = hash.subarray(0, 32);
  return Keypair.fromSeed(Uint8Array.from(seed));
} 