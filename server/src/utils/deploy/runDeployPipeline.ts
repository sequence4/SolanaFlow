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
  runCommand
} from "../projectUtils";
import { waitForTaskCompletion, getTaskById } from "../taskUtils";
import { deriveProgramId } from "../../utils/deriveProgramId";
import path from "path";
import { attachFileContents } from "../fileUtils/attachFileContents";
import { v4 as uuidv4 } from "uuid";

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
    
    // wait until all src + UI files are on disk
    await waitForTaskCompletion(`WRITE_SRCS_${projectId}`, 15, 2_000);
    
    sendProgress({ stage: "build-started", message: "Building program…" });
    const buildTask = await startAnchorBuildTask(projectId, userId);
    
    // Convert env-driven minutes → retry count (2-second interval)
    const buildMinutes = Number(process.env.MAX_BUILD_MINUTES) || 15;
    const buildRetries = Math.ceil(buildMinutes * 60_000 / 2_000);
    
    // Check build status and bail early if not successful
    const buildStatus = await waitForTaskCompletion(buildTask, buildRetries, 2_000);
    if (buildStatus !== 'succeed' && buildStatus !== 'finished') {
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

      sendProgress({
        stage: "link-so",
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
    console.log("[PIPELINE] 📦 artefact length:", base64So.length);
    
    /* ---------------------------------------------------------------- *
     * 3c ─ build finished → gather file-tree with eager code
     * ---------------------------------------------------------------- */
    sendProgress({ stage: "file-tree-start", message: "Collecting project files…" });

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
    sendProgress({
      stage   : "build-done",
      message : "Build finished",
      artifact: base64So,
      fileTree                       // <= NEW
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

    // Copy the Anchor-generated IDL to the frontend idl directory
    if (programId) {
      sendProgress({
        stage: "copy-idl",
        message: "Saving Anchor IDL for frontend..."
      });

      try {
        // Find the program name from the file tree
        const rootPath = workspace.rootPath ?? (
          await import("../fileUtils").then(m => m.getProjectRootPath(projectId))
        );

        // Default program name (same as in handleGenerateCode)
        const programName = 'my_program'; // Using the same default as in handleGenerateCode

        // Generate a task ID for running commands
        const idlTaskId = uuidv4();

        // NOTE: no leading \n, use ';' instead of '&&' after `then`
        const copyIdlCmd =
          "set -e; " +
          `cd /usr/src/${rootPath}; ` +
          "mkdir -p idl; " +
          `if [ -f target/idl/${programName}.json ]; then ` +
          // update .metadata.address in-place with jq (no temp file needed)
          `jq --arg addr '${programId}' '.metadata.address = \\$addr' ` +
          `target/idl/${programName}.json > idl/solanaflow_token.json; ` +
          `echo 'IDL copied to idl/solanaflow_token.json'; ` +
          "else " +
          `echo '{}' > idl/solanaflow_token.json; ` +
          `echo 'IDL placeholder generated'; ` +
          "fi";

        await runCommand(
          `docker exec ${workspace.containerName} bash -c "${copyIdlCmd}"`,
          ".",
          idlTaskId,
          { skipSuccessUpdate: true }
        );

        console.log(`[DEPLOY] IDL copied to idl/solanaflow_token.json for program ${programId}`);
      } catch (error) {
        console.error("[DEPLOY] IDL copy failed for program", programId, error);
        // Non-fatal error, continue with deployment
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