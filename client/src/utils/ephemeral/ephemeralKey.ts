import { Keypair } from '@solana/web3.js';
import { projectApi } from '@/api/projectApi';

/**
 * Requests the backend to generate a new ephemeral Keypair and returns its PublicKey.
 */
export async function createAndRegisterEphemeral(projectId: string) {
  // Ask the backend to create an ephemeral keypair and return its pubkey
  const { pubkey } = await projectApi.createEphemeral(projectId);
  return pubkey;
} 