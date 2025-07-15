import { Keypair } from '@solana/web3.js';
import { projectApi } from '@/api/projectApi';
import { createHash } from 'crypto';

/**
 * Generates a deterministic keypair from the projectId,
 * posts its secretKey array to the backend, and returns the Keypair
 * so the caller can sign deploy txs locally.
 */
export async function createAndRegisterEphemeral(projectId: string) {
  // Derive a deterministic keypair from the projectId for a stable program ID
  // Use the same derivation method as server-side to ensure consistent IDs
  const encoder = new TextEncoder();
  const seedData = encoder.encode(projectId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', seedData);
  const seedArray = new Uint8Array(hashBuffer);
  const kp = Keypair.fromSeed(seedArray);
  
  console.log(`[EPHEMERAL] Generated deterministic keypair from project ID: ${projectId}`);
  console.log(`[EPHEMERAL] Public key: ${kp.publicKey.toBase58()}`);

  // Register the keypair with the backend (store secret for consistency)
  const result = await projectApi.createEphemeral(projectId, Array.from(kp.secretKey));
  return { keypair: kp, programSecretKey: result.programSecretKey };
} 