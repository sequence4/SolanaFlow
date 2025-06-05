import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { deployWithEphemeralKey } from '../../lib/ephemeralDeployment';
import { projectApi } from '../../api/projectApi';
import { toast } from 'sonner';

/**
 * Handles the deployment of a Solana program using an ephemeral key approach
 * to avoid blockhash not found errors when deploying large programs
 */
export async function handleEphemeralDeploy(
  projectId: string, 
  programSoData: ArrayBuffer,
  onProgress: (progress: number, message: string) => void
) {
  try {
    // Use wallet adapter from context
    const wallet = useWallet();
    const { connection } = useConnection();

    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected or does not support signing');
    }

    onProgress(0, 'Starting ephemeral key deployment...');

    // 1. Use the ephemeral key approach to handle the deployment
    // This returns quickly because all transactions are signed by the ephemeral key
    const deployResult = await deployWithEphemeralKey({
      soBytes: programSoData,
      connection,
      wallet,
      onProgress
    });

    onProgress(95, 'Deployment successful, registering with server...');

    // 2. Update the server with the deployed program ID
    // Store the program ID in the project context
    await projectApi.updateProject(projectId, {
      id: projectId,
      details: {
        projectState: {
          programId: deployResult.programId.toString()
        }
      }
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