//import { getBuildArtifactTask, startAnchorBuildTask, startAnchorDeployTask } from "./projectUtils";
//import { startAnchorInitTask } from "./projectUtils";
//import { waitForTaskCompletion } from "./taskUtils";
import { prepEnv } from './prepEnv';
import type { WorkspaceHandle } from './prepEnv';
import { Graph } from '../../types/graph';
import { handleGenerateCode } from "../codeGen/handleGenerateCode";
import { pruneContainerResources } from '../container/pruneContainer';
import {
  startAnchorBuildTask,
  startAnchorDeployTask,
  getBuildArtifactTask,
} from "../projectUtils";
import { waitForTaskCompletion, getTaskById } from "../taskUtils";

interface PipelineArgs {
  projectId: string;
  userId: string;
  graph: Graph; 
  sendProgress: (data: unknown) => void;
  /** Optional base58 pubkey of a temp keypair the UI created for this run */
  ephemeralPubkey?: string;
}

export async function runDeployPipeline({
  projectId,
  userId,
  graph,
  sendProgress,
  ephemeralPubkey,
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
    
    // Convert timeout ms to retry count (2-second default interval)
    const buildRetries = Math.ceil(120_000 / 2_000); // 60 tries = 2 min
    
    await waitForTaskCompletion(buildTask, buildRetries);
    console.log("[PIPELINE] ✅ build task", buildTask, "completed");

    /* 3b ─ fetch artefact ------------------------------------------------ */
    console.log("[PIPELINE] 📦 fetching artefact (.so) from container");
    const { base64So } = await getBuildArtifactTask(projectId);
    console.log("[PIPELINE] 📦 artefact length:", base64So?.length ?? 0);
    sendProgress({
      stage   : "build-done",
      message : "Build finished",
      artifact: base64So,                // front-end can create a download link
    });

    /* 4 ─ deploy --------------------------------------------------------- */
    sendProgress({ stage: "deploy", message: "Deploying / upgrading…" });

    // Get deployment timeout from env, ensure it's at least 1 minute
    const deployMinutes = Number(process.env.MAX_DEPLOY_MINUTES || 6);
    const deployTimeoutMs = (deployMinutes >= 1 ? deployMinutes : 6) * 60_000;
    
    // Convert timeout ms to retry count (2-second default interval)
    const deployRetries = Math.ceil(deployTimeoutMs / 2_000);

    // Launch the async deploy task inside the container
    const deployTask = await startAnchorDeployTask(
      projectId,
      userId,
      ephemeralPubkey
    );

    // Allow up to specified minutes for Devnet transaction retries
    await waitForTaskCompletion(deployTask, deployRetries);

    // Retrieve the task's JSON result
    const { status, result } = await getTaskById(deployTask);
    
    if (status !== 'succeed' && status !== 'finished') {
      throw new Error(`Deployment task failed with status: ${status}`);
    }
    
    if (!result) {
      throw new Error("Deployment task finished without a result");
    }
    
    let programId: string | undefined;
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

    sendProgress({
      stage    : "done", // Keep original stage name for backward compatibility
      message  : "Deployment complete",
      programId: programId,           // UI can deep-link to the explorer
    });

  } finally {
    /* ----------------------------------------------------------------
     * DEV-only cleanup: stop & delete the container + dangling volumes
     * ---------------------------------------------------------------- */
    if (workspace) {
      try {
        pruneContainerResources(workspace.containerName, projectId);
        console.log(`[cleanup] pruned container ${workspace.containerName}`);
      } catch (err) {
        console.warn('[cleanup] failed to prune container:', err);
      }
    }
  }
}