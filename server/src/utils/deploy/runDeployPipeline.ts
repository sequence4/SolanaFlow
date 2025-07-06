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
  getBuildArtifactTask,
  runCommand,
  startAnchorInitTask,
  startSetClusterTask,
} from "../projectUtils";
import { waitForTaskCompletion } from "../taskUtils";
import path from "path";
import { attachFileContents } from "../fileUtils/attachFileContents";
import { builderImage } from './builderImage';

// ─── unified progress payload ────────────────────────────
interface ProgressEvent {
  stage : "environment" | "code-gen" | "build" | "error";
  status: "active" | "completed" | "error";
  message: string;
  pct?: number;
  [k: string]: unknown;           // allow artefact / containerUrl etc.
}
// ──────────────────────────────────────────────────────────────

// TODO: chunk really large fileTree payloads (> ~16 MB) – Chrome drops giant SSE frames.

const MAX_BUILD_MINUTES = Number(process.env.MAX_BUILD_MINUTES) || 15;

interface PipelineArgs {
  projectId: string;
  userId: string;
  graph: Graph; 
  sendProgress: (data: unknown) => void;

  /** When true, the program was already deployed by a wallet-signed tx */
  walletSigned?: boolean;
  
  /** When true, run the container in dev mode with hot-reload */
  devMode?: boolean;
}

// NOTE: Pipeline now runs linearly inside runDeployPipeline().
// Removed the old STAGES array and helper functions.

export async function runDeployPipeline({
  projectId,
  userId,
  graph,
  sendProgress,
  walletSigned = false,
  devMode = false,
}: PipelineArgs): Promise<void> {
  sendProgress(<ProgressEvent>{
    stage: "environment",
    status: "active",
    message: "Preparing your build environment…"
  });

  // declare outside try so `finally` can see it
  let workspace: WorkspaceHandle | null = null;

  try {
    workspace = await prepEnv(projectId, userId, devMode);

    sendProgress(<ProgressEvent>{
      stage: 'environment',
      status: 'active',
      message: 'Pulling tool-chain image…'    // new granular step
    });
    
    // emit the container URL so the UI can tune in
    sendProgress(<ProgressEvent>{
      stage: 'environment',
      status: 'active',
      message: 'Image pulled — starting container…'
    });

    sendProgress(<ProgressEvent>{
      stage: "environment",
      status: "completed",
      message: "Container is up",
      containerUrl: workspace.containerUrl
    });
 
    
    // 2 ─ code generation ─────────────────────────────────────────────────
    sendProgress(<ProgressEvent>{
      stage: "code-gen",
      status: "active",
      message: "Generating Anchor code…"
    });
    sendProgress({ stage: "code-gen", message: "Generating Anchor code…" });
    const { sentinelId } =
          await handleGenerateCode({ projectId, graph, workspace, sendProgress, userId });

    /* 3 ─ build program --------------------------------------------------- */
    console.log("[PIPELINE] ⏳ anchor build started…");
    
    // wait until all src + UI files are on disk
    // allow up to 3 min for large repos (90 × 2 s)
    await waitForTaskCompletion(sentinelId, 90, 2_000);

    // ✅ code-gen really is done now
    sendProgress(<ProgressEvent>{
      stage   : "code-gen",
      status  : "completed",
      message : "Code generation complete"
    });
    
    sendProgress(<ProgressEvent>{
      stage: "build",
      status: "active",
      message: "Building program…"
    });
    const buildTask = await startAnchorBuildTask(projectId, userId);
    
    // Compute retry count based on configured build timeout
    const buildMinutes = MAX_BUILD_MINUTES;
    const buildRetries = Math.ceil(buildMinutes * 60_000 / 2_000);
    
    // Check build status and bail early if not successful
    const buildStatus = await waitForTaskCompletion(buildTask, buildRetries, 2_000);
    const OK_STATUSES = ['succeed', 'finished', 'warning']; // Anchor warns but succeeds
    if (!OK_STATUSES.includes(buildStatus)) {
      throw new Error(`Build task ended with status: ${buildStatus}`);
    }
    
    /* ------------------------------------------------------------------ *
     * 3a ─ make ./target/deploy point at the warmed cache
     * ------------------------------------------------------------------ */
    {
      // If prepEnv already gave you the project root use it, otherwise
      // fall back to a helper that reads solanaproject.root_path
      const projectFolder =
        workspace.rootPath ??
        (await import("../fileUtils").then(m =>
          m.getProjectRootPath(projectId)
        ));

      sendProgress(<ProgressEvent>{
        stage: "build",
        status: "active",
        message: "Linking target/deploy → /usr/src/target/deploy"
      });

      // One-liner executed *inside* the running container
      const linkCmd = [
        `cd /usr/src/${projectFolder}`,
        'rm -rf target/deploy',                // remove accidental dir, if any
        'mkdir -p target',
        // -T treats DEST as a file so ln never creates "deploy/deploy"
        'ln -sfnT /usr/src/target/deploy target/deploy'
      ].join(" && ");

      // Generate a unique task ID for the symlink command
      const symlinkTaskId = `symlink-${projectId}-${Date.now()}`;
      
      // `runCommand` already wraps child_process.exec for you
      await runCommand(`docker exec ${workspace.containerName} bash -c '${linkCmd}'`,
                       ".", symlinkTaskId, { skipSuccessUpdate: true });
    }
    
    console.log("[PIPELINE] ✅ build task", buildTask, "completed");

    /* 3b ─ fetch artefact ------------------------------------------------ */
    console.log("[PIPELINE] 📦 fetching artefact (.so) from container");
    const { base64So } = await getBuildArtifactTask(projectId);
    if (!base64So) {
      throw new Error('Anchor built with warnings but produced no .so – check build log');
    }
    console.log("[PIPELINE] 📦 artefact length:", base64So.length);
    
    /* ---------------------------------------------------------------- *
     * 3c ─ build finished → gather file-tree with eager code
     * ---------------------------------------------------------------- */
    sendProgress(<ProgressEvent>{
      stage: "build",
      status: "active",
      message: "Collecting project files…"
    });

    // (1) build the raw tree via the existing utility
    const rootPath = workspace.rootPath ?? (
      await import("../fileUtils").then(m => m.getProjectRootPath(projectId))
    );
    const rawTreeTask = await import("../fileUtils")
      .then(m => m.startGenerateFileTreeTask(projectId, rootPath, userId));
    await import("../taskUtils").then(m => m.pollTaskStatus(rawTreeTask));

    const { result: treeJson } = await import("../taskUtils")
      .then(m => m.getTaskById(rawTreeTask));
    const rawTree: any[] = treeJson ? JSON.parse(treeJson) : [];

    // (2) attach code for the important files
    const rootBase = process.env.ROOT_FOLDER;
    if (!rootBase) {
      throw new Error("ROOT_FOLDER env var not set");
    }
    const absRoot = path.join(rootBase, rootPath);
    await attachFileContents(rawTree, absRoot, workspace.containerName);
    const fileTree = rawTree;  // now populated

    /* finally emit build-done with artefact + file tree */
    sendProgress(<ProgressEvent>{
      stage   : "build",
      status  : "completed",
      message : "Build finished",
      artifact: base64So,
      fileTree
    });

  } catch (err) {
    sendProgress(<ProgressEvent>{
      stage: "error",
      status: "error",
      message: err instanceof Error ? err.message : String(err)
    });
    throw err;
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

