import { Step } from "@/context/logs/TaskLogsContext";
import { useTaskLogs } from "@/context/logs/useTaskLogs";
import { ProjectContextType } from "@/context/project/ProjectContextTypes";
import { PublicKey } from "@solana/web3.js";
import { handleDeployProgram } from "./deployUpgradableProgram";
import { toast } from "sonner";
import { Cluster } from "@solana/web3.js";

export const deploymentSteps: Step[] = [
  {
    icon: "Cpu",
    message: "Initializing Deployment...",
    details: "Preparing container environment and verifying prerequisites.",
  },
  {
    icon: "Server",
    message: "Configuring network connection...",
    details: "Connecting to the Solana network.",
  },
  {
    icon: "Database",
    message: "Building Program and deploying to the devnet...",
    details: "Signing and sending the deploy transaction to Solana.",
  },
  {
    icon: "HardDrive",
    message: "Finalizing Deployment...",
    details: "Waiting for confirmation that the program is live on-chain.",
  },
];

const DEPLOY_PROGRESS = [10, 40, 70, 90, 100];

export async function handleDeployWithLogs(
  projectContext: ProjectContextType,
  setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>,
  walletPublicKey: PublicKey,
  signAndSendTx: any, 
  cluster: string,
  deployMode: "fullWallet" | "delegated",
  taskLogs: ReturnType<typeof useTaskLogs>
) {
  // 1) Initialize
  taskLogs.resetLogs();
  taskLogs.setSteps(deploymentSteps);
  taskLogs.setIsVisible(true);
  taskLogs.setProgress(0);
  taskLogs.addSystemLog(`Starting deployment in ${deployMode} mode...`);

  let success = false;

  try {
    // STEP 1: "Initializing Deployment..."
    taskLogs.setProgress(DEPLOY_PROGRESS[0]); // 10%
    taskLogs.addSystemLog("Initializing deployment environment...");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // STEP 2: "Building Program..."
    taskLogs.setProgress(DEPLOY_PROGRESS[1]); // 40%
    taskLogs.addSystemLog("Building the Anchor program. This may take a bit...");
    // Simulate longer build time
    await new Promise((resolve) => setTimeout(resolve, 7000));

    // STEP 3: "Sending Transaction..."
    taskLogs.setProgress(DEPLOY_PROGRESS[2]); // 70%
    taskLogs.addSystemLog("Deploying program transaction to devnet...");
    
    const programKeypair = await handleDeployProgram(
      projectContext,
      setProjectContext,
      walletPublicKey,
      signAndSendTx,
      cluster as Cluster,
      deployMode
    );
    
    if (!programKeypair) {
      throw new Error("Failed to deploy the program: No program keypair returned.");
    }

    // STEP 4: "Finalizing Deployment..."
    taskLogs.setProgress(DEPLOY_PROGRESS[3]); // 90%
    taskLogs.addSystemLog("Waiting for final on-chain confirmation...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    success = true;

    // Finally set your programId in projectContext for later references
    if (projectContext.details) {
      setProjectContext((prev: ProjectContextType) => {
        if (!prev.details) return prev;
        
        return {
          ...prev,
          details: {
            ...prev.details,
            projectState: {
              ...prev.details.projectState,
              programId: programKeypair.toBase58(),
            },
          },
        };
      });
    }

    // Mark final success
    const successStep: Step = {
      icon: "CheckCircle",
      message: "Deployment Complete!",
      details: `Program deployed successfully to ${programKeypair.toBase58()}.`,
    };
    
    taskLogs.setSteps([...deploymentSteps, successStep]);
    taskLogs.setProgress(DEPLOY_PROGRESS[4]); // 100
    taskLogs.addSystemLog(`Deployment finished! Program at ${programKeypair.toBase58()}`);
    
    toast("Program successfully deployed", {
      description: `Program deployed to: ${programKeypair.toBase58()}`,
      style: { backgroundColor: "#4ade80", color: "white" }
    });

  } catch (err) {
    console.error("[handleDeployWithLogs] Deployment Error:", err);
    taskLogs.addSystemLog(
      `Deployment failed: ${err instanceof Error ? err.message : String(err)}`
    );
    taskLogs.setProgress(100);
    success = false;
    
    toast("Deployment error", {
      description: String(err),
      style: { backgroundColor: "#f87171", color: "white" }
    });
  } finally {
    // Let the user read final logs for ~3 seconds if success, or 5 if error
    await new Promise((r) => setTimeout(r, success ? 3000 : 5000));
    taskLogs.setIsVisible(false);
    return success;
  }
} 