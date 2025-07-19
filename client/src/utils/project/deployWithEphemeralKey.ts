import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { deployWithEphemeralKey } from '../../lib/ephemeralDeployment';
import bs58 from 'bs58';
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

    // 1. Generate an ephemeral keypair and register it
    const { keypair: ephem, programSecretKey } = await createAndRegisterEphemeral(projectId);

    // Determine programId or secret key from project details or env
    let programIdArg: PublicKey | undefined;
    let programSecretArg: number[] | undefined;
    try {
      const project = await projectApi.getProjectDetails(projectId);
      const existingProgramIdStr = project?.details?.projectState?.programId as
        | string
        | null
        | undefined;
      if (existingProgramIdStr) {
        try {
          programIdArg = new PublicKey(existingProgramIdStr);
          console.log(`[handleEphemeralDeploy] Using existing program ID: ${existingProgramIdStr} for upgrade`);
        } catch (e) {
          console.warn(
            `[handleEphemeralDeploy] Invalid existing program ID: ${existingProgramIdStr}`,
            e,
          );
        }
      }
    } catch (e) {
      console.warn('[handleEphemeralDeploy] Could not fetch project details', e);
    }

    // 2. Use the ephemeral key approach to handle the deployment
    // Configure deployment parameters with appropriate program identification
    const deployParams: any = {
      soBytes: programSoData,
      connection,
      wallet,
      ephemeralKeypair: ephem,
      onProgress,
    };

    // Priority: 1. Existing programId from server, 2. Program secret key from backend, 3. Env variable
    if (programIdArg) {
      // Use existing program ID for upgrades
      deployParams.programId = programIdArg;
    } else {
      // Try the backend programSecretKey first
      if (programSecretKey && programSecretKey.length === 64) {
        deployParams.programSecretKey = programSecretKey;
        console.log("[handleEphemeralDeploy] Using program secret key from build pipeline");
      } else {
        // Fall back to environment variable
        const envSecret = process.env.NEXT_PUBLIC_PROGRAM_SECRET_KEY;
        if (envSecret) {
          let arr: number[] | undefined;
          try {
            if (envSecret.trim().startsWith('[')) {
              arr = JSON.parse(envSecret) as number[];
            } else {
              const decoded = bs58.decode(envSecret.trim());
              arr = Array.from(decoded);
            }
          } catch (e) {
            console.warn(
              '[handleEphemeralDeploy] Failed to parse NEXT_PUBLIC_PROGRAM_SECRET_KEY',
              e,
            );
          }
          if (arr && arr.length === 64) {
            deployParams.programSecretKey = arr;
            console.log("[handleEphemeralDeploy] Using program secret key from environment");
          } else {
            console.warn(
              '[handleEphemeralDeploy] NEXT_PUBLIC_PROGRAM_SECRET_KEY is not a valid 64-byte secret key',
            );
          }
        } else if (!programSecretKey) {
          // Only throw if we have no secret key at all
          throw new Error('No program keypair or ID found for deployment');
        }
      }
    }

    const deployResult = await deployWithEphemeralKey(deployParams);

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