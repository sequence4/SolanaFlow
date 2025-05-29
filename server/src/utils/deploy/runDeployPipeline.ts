//import { getBuildArtifactTask, startAnchorBuildTask, startAnchorDeployTask } from "./projectUtils";
//import { startAnchorInitTask } from "./projectUtils";
//import { waitForTaskCompletion } from "./taskUtils";
import { prepEnv } from './prepEnv';
import type { WorkspaceHandle } from './prepEnv';
import { Graph } from '../../types/graph';
import { handleGenerateCode } from "../codeGen/handleGenerateCode";
import { pruneContainerResources } from '../container/pruneContainer';
import { startAnchorBuildTask } from "../projectUtils";
import { waitForTaskCompletion } from "../taskUtils";

interface PipelineArgs {
  projectId: string;
  userId: string;
  graph: Graph; 
  sendProgress: (data: unknown) => void;
}

export async function runDeployPipeline({
  projectId,
  userId,
  graph,
  sendProgress,
}: PipelineArgs) {
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
    sendProgress({ stage: "build", message: "Building program…" });
    const buildTask = await startAnchorBuildTask(projectId, userId);
    await waitForTaskCompletion(buildTask, 120_000);  // 2-min guard
    sendProgress({ stage: "build-done", message: "Build finished" });

    // Keep deployment simulation for now
    await new Promise(resolve => setTimeout(resolve, 1000));
    sendProgress({ stage: "deploy", message: "Deploying / upgrading…" });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    sendProgress({ stage: "done", message: "Deployment complete" });

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