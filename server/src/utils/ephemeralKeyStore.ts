import { Keypair } from '@solana/web3.js';

// Store ephemeral keys by project ID
const projectEphemeralKeys = new Map<string, Keypair>();

export const storeProjectEphemeralKey = (projectId: string, keypair: Keypair) => {
  projectEphemeralKeys.set(projectId, keypair);
  console.log(`[EPHEMERAL_STORE] Stored ephemeral key for project ${projectId}: ${keypair.publicKey.toBase58()}`);
};

export const getProjectEphemeralKey = (projectId: string): Keypair | undefined => {
  const key = projectEphemeralKeys.get(projectId);
  if (key) {
    console.log(`[EPHEMERAL_STORE] Retrieved ephemeral key for project ${projectId}: ${key.publicKey.toBase58()}`);
  } else {
    console.log(`[EPHEMERAL_STORE] No ephemeral key found for project ${projectId}`);
  }
  return key;
};

export const clearProjectEphemeralKey = (projectId: string) => {
  projectEphemeralKeys.delete(projectId);
  console.log(`[EPHEMERAL_STORE] Cleared ephemeral key for project ${projectId}`);
};