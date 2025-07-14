import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { deployWithEphemeralKey } from '../../lib/ephemeralDeployment';
import { projectApi } from '../../api/projectApi';
import { toast } from 'sonner';
import { createAndRegisterEphemeral } from '@/utils/ephemeral/ephemeralKey';

/**
 * Handles the deployment of a Solana program using an ephemeral key approach
 * to avoid blockhash not found errors when deploying large programs
 */
export async function handleEphemeralDeploy(
  projectId: string,
  programSoData: ArrayBuffer,
  connection: Connection,
  wallet: WalletContextState,
  onProgress: (progress: number, message: string) => void
) {
  try {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected or does not support signing');
    }

    onProgress(0, 'Starting ephemeral key deployment...');

    // 1. Generate an ephemeral keypair and register it (retrieve program secret key)
    const { keypair: ephem, programSecretKey } = await createAndRegisterEphemeral(projectId);
    
    // 2. Use the ephemeral key approach to handle the deployment
    if (!programSecretKey) {
      throw new Error('Prebuilt program keypair not found for deployment');
    }
    const deployResult = await deployWithEphemeralKey({
      soBytes: programSoData,
      connection,
      wallet,
      ephemeralKeypair: ephem,
      programSecretKey: programSecretKey,
      onProgress
    });

    onProgress(95, 'Deployment successful, registering with server...');

    // 3. Update the server with the deployed program ID in project details
    await projectApi.updateProject(projectId, {
      details: {
        projectState: {
          deployed: true,
          built: false,
          programId: deployResult.programId.toString(),
        },
      },
    });

    onProgress(100, 'Deployment complete!');

    return {
      success: true,
      programId: deployResult.programId.toString(),
      signatures: deployResult.signatures
    };
  } catch (error: any) {
    console.error('Ephemeral deployment failed:', error);
    toast.error(`Deployment failed: ${error.message}`);
    
    return {
      success: false,
      error: error.message
    };
  }
} 