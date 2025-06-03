//import { getBuildArtifactTask, startAnchorBuildTask, startAnchorDeployTask } from "./projectUtils";
//import { startAnchorInitTask } from "./projectUtils";
//import { waitForTaskCompletion } from "./taskUtils";
import { prepEnv } from './prepEnv';
import type { WorkspaceHandle } from './prepEnv';
import { Graph } from '../../types/graph';
import { handleGenerateCode } from "../codeGen/handleGenerateCode";
import { markContainerForCleanup } from "../container/cleanupQueue";
import {
  startAnchorBuildTask,
  startAnchorDeployTask,
  getBuildArtifactTask,
} from "../projectUtils";
import { waitForTaskCompletion, getTaskById } from "../taskUtils";
import { deriveProgramId } from "../../utils/deriveProgramId";

interface PipelineArgs {
  projectId: string;
  userId: string;
  graph: Graph; 
  sendProgress: (data: unknown) => void;

  /** When true, the program was already deployed by a wallet-signed tx */
  walletSigned?: boolean;
}

export async function runDeployPipeline({
  projectId,
  userId,
  graph,
  sendProgress,
  walletSigned = false,
}: PipelineArgs): Promise<void> {
  sendProgress({ stage: "environment", message: "Preparing your build environment…" });

  // declare outside try so `finally` can see it
  let workspace: WorkspaceHandle | null = null;

  try {
    workspace = await prepEnv(projectId, userId);

    // emit the container URL so the UI can tune in
    sendProgress({
      stage: "container-ready",
      containerUrl: workspace.containerUrl,
      message: "Container is up"
    });
 
    
    // 2 ─ code generation ─────────────────────────────────────────────────
    sendProgress({ stage: "code-gen", message: "Generating Anchor code…" });
    await handleGenerateCode({ projectId, graph, workspace, sendProgress, userId });

    /* 3 ─ build program --------------------------------------------------- */
    console.log("[PIPELINE] ⏳ anchor build started…");
    sendProgress({ stage: "build", message: "Building program…" });
    const buildTask = await startAnchorBuildTask(projectId, userId);
    
    // Convert env-driven minutes → retry count (2-second interval)
    const buildMinutes = Number(process.env.MAX_BUILD_MINUTES) || 15;
    const buildRetries = Math.ceil(buildMinutes * 60_000 / 2_000);
    
    // Check build status and bail early if not successful
    const buildStatus = await waitForTaskCompletion(buildTask, buildRetries, 2_000);
    if (buildStatus !== 'succeed' && buildStatus !== 'finished') {
      throw new Error(`Build task ended with status: ${buildStatus}`);
    }
    
    console.log("[PIPELINE] ✅ build task", buildTask, "completed");

    /* 3b ─ fetch artefact ------------------------------------------------ */
    console.log("[PIPELINE] 📦 fetching artefact (.so) from container");
    const { base64So } = await getBuildArtifactTask(projectId);
    console.log("[PIPELINE] 📦 artefact length:", base64So.length);
    sendProgress({
      stage   : "build-done",
      message : "Build finished",
      artifact: base64So,                // front-end can create a download link
    });

    /* 4 ─ deploy --------------------------------------------------------- */
    let programId: string | undefined;
    
    if (!walletSigned) {
      sendProgress({ stage: "deploy", message: "Deploying / upgrading…" });

      // Parse deployment timeout from env with better handling
      const deployMinutesRaw = Number(process.env.MAX_DEPLOY_MINUTES);
      const deployMinutes = Number.isFinite(deployMinutesRaw) && deployMinutesRaw >= 1
        ? Math.ceil(deployMinutesRaw)
        : 6;
      const deployTimeoutMs = deployMinutes * 60_000;
      
      // Convert timeout ms to retry count (2-second interval)
      const deployRetries = Math.ceil(deployTimeoutMs / 2_000);

      // Launch the async deploy task inside the container
      const deployTask = await startAnchorDeployTask(
        projectId,
        userId
      );

      // Allow up to specified minutes for Devnet transaction retries
      const deployStatus = await waitForTaskCompletion(deployTask, deployRetries, 2_000);
      if (deployStatus !== 'succeed' && deployStatus !== 'finished') {
        throw new Error(`Deployment task failed with status: ${deployStatus}`);
      }

      // Retrieve the task's JSON result
      const { status, result } = await getTaskById(deployTask);
      
      if (status !== 'succeed' && status !== 'finished') {
        throw new Error(`Deployment task failed with status: ${status}`);
      }
      
      if (!result) {
        throw new Error("Deployment task finished without a result");
      }
      
      try {
        const parsed = JSON.parse(result) as 
          | { status: "success"; programId: string }
          | Record<string, unknown>;
          
        if (parsed.status === "success" && typeof parsed.programId === "string") {
          programId = parsed.programId;
        }
      } catch { /* ignore malformed JSON; handled below */ }

      if (!programId) {
        throw new Error("Deployment task finished without a valid Program ID");
      }
    } else {
      sendProgress({
        stage   : "deploy-skipped",
        message : "Wallet-signed deploy detected – skipping Anchor deploy step"
      });
      
      // For wallet-signed deployments, extract programId from graph if available
      const graphWithConfig = graph as unknown as { deployConfig?: { programId?: string } };
      if (graphWithConfig.deployConfig?.programId) {
        programId = graphWithConfig.deployConfig.programId;
      }
      
      // If no programId is available, derive it deterministically
      if (!programId) {
        programId = deriveProgramId(projectId).toBase58();
      }
    }

    // Only include programId in the completion event if we have one
    const completionEvent: Record<string, unknown> = {
      stage: "done",
      message: "Deployment complete"
    };
    
    if (programId) {
      completionEvent.programId = programId;
    }

    sendProgress(completionEvent);

  } finally {
    /* ----------------------------------------------------------------
     * Queue container for later cleanup instead of immediate deletion
     * ---------------------------------------------------------------- */
    if (workspace) {
      await markContainerForCleanup(projectId, workspace.containerName);
      console.log(`[pipeline] queued ${workspace.containerName} for later cleanup`);
    }
  }
}