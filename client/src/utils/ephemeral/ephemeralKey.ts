import { Keypair } from '@solana/web3.js';
import { projectApi } from '@/api/projectApi';

/**
 * Generates an in-memory Keypair, posts its secretKey array to the backend
 * and returns the Keypair so the caller can sign deploy txs locally.
 */
export async function createAndRegisterEphemeral(projectId: string) {
  const kp = Keypair.generate(); // 64-byte secret; never hits localStorage

  await projectApi.createEphemeral(projectId, Array.from(kp.secretKey));
  return kp;
} 