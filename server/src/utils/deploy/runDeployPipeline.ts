//import { getBuildArtifactTask, startAnchorBuildTask, startAnchorDeployTask } from "./projectUtils";
//import { startAnchorInitTask } from "./projectUtils";
//import { waitForTaskCompletion } from "./taskUtils";
import { prepEnv } from './prepEnv';
import type { WorkspaceHandle } from './prepEnv';
import { Graph } from '../../types/graph';
import { handleGenerateCode } from "../codeGen/handleGenerateCode";

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
    const workspace = await prepEnv(projectId, userId);

    // emit the container URL so the UI can tune in
    sendProgress({
      stage: "container-ready",
      containerUrl: workspace.containerUrl,
      message: "Container is up"
    });
 
    
    // 2 ─ code generation ─────────────────────────────────────────────────
    sendProgress({ stage: "code-gen", message: "Generating Anchor code…" });
    await handleGenerateCode({ projectId, graph, workspace, sendProgress });
    /*
    // 3 ─ anchor init (skip for lite) ─────────────────────────────────────
    const { isLite } = await fetchProjectFlags(projectId);
    if (!isLite) {
      sendProgress({ stage: "init", message: "Running anchor init…" });
      const initTask = await startAnchorInitTask(projectId, workspace, userId);
      await waitForTaskCompletion(initTask);
    }
 
    // 4 ─ build  (skip if binary unchanged) ───────────────────────────────
    if (await needsBuild(projectId)) {
      sendProgress({ stage: "build", message: "Building program…" });
      const buildTask = await startAnchorBuildTask(projectId, userId);
      await waitForTaskCompletion(buildTask, 120000); // 2-min timeout
    } else {
      sendProgress({ stage: "build-skip", message: "Cached build reused." });
    }
 
    // 5 ─ deploy ──────────────────────────────────────────────────────────
    sendProgress({ stage: "deploy", message: "Deploying / upgrading…" });
    const deployTask = await startAnchorDeployTask(projectId, userId);
    await waitForTaskCompletion(deployTask, 120000);
 
    // 6 ─ fetch txSig & report ────────────────────────────────────────────
    const txSig = await getTxSigFromTask(deployTask);
    sendProgress({ stage: "deploy-done", txSig });
    */
    
    // For testing purposes, let's simulate the pipeline stages
    await new Promise(resolve => setTimeout(resolve, 1000));
    sendProgress({ stage: "code-gen", message: "Generating Anchor code…" });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    sendProgress({ stage: "build", message: "Building program…" });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    sendProgress({ stage: "deploy", message: "Deploying / upgrading…" });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    sendProgress({ stage: "done", message: "Deployment complete" });
  }
 
  /*
  async function needsBuild(projectId: string): Promise<boolean> {
    const artifact = await getBuildArtifactTask(projectId);
    // quick checksum against latest code hash (implement as you like)
    return !artifact?.sha256 || artifact.sha256 !== (await currentCodeHash(projectId));
  }
 
  async function currentCodeHash(projectId: string): Promise<string> {
    // tiny helper that SHA-256's lib.rs + instruction/*.rs inside container
    // implement with `docker exec sh -c 'sha256sum …'` or Node hashing
    return "dummy-hash"; // placeholder
  }
 
  async function fetchProjectFlags(projectId: string) {
    const r = await pool.query<{
      details: any;
    }>("SELECT details FROM solanaproject WHERE id = $1", [projectId]);
    const details =
      typeof r.rows[0].details === "string"
        ? JSON.parse(r.rows[0].details)
        : r.rows[0].details || {};
    return {
      isLite: !!details.isLite,
    };
  }
 
  async function getTxSigFromTask(taskId: string): Promise<string | null> {
    const r = await pool.query<{ result: string }>(
      "SELECT result FROM task WHERE id=$1",
      [taskId]
    );
    return r.rows[0]?.result || null;
  }

*/