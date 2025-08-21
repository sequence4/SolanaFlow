import { prepEnv } from './prepEnv';
import type { WorkspaceHandle } from './prepEnv';
import { Graph } from '../../types/graph';
import { handleGenerateCode } from "../codeGen/handleGenerateCode";
import { markContainerForCleanup } from "../container/cleanupQueue";
import {
  startAnchorBuildTask,
  getBuildArtifactTask,
  runCommand,
} from "../projectUtils";
import { waitForTaskCompletion } from "../taskUtils";
import path from "path";
import { execSync } from "child_process"; 
import { Keypair } from "@solana/web3.js";
import { attachFileContents } from "../fileUtils/attachFileContents";
import { readContainerFile } from "../fileUtils/attachFileContents";
import { v4 as uuidv4 } from "uuid";
import { sendEnvironmentProgress, sendBuildProgress, resetProgress } from "../progressUtils";

// ─── unified progress payload ────────────────────────────
interface ProgressEvent {
  stage : "environment" | "code-gen" | "build" | "error";
  status: "active" | "completed" | "error";
  message: string;
  pct?: number;
  [k: string]: unknown;      
}

// ─── Enhanced Progress Manager with atomic stage transitions ──────
class ProgressManager {
  private currentStage: string = '';
  private stageProgress: Map<string, number> = new Map();
  private eventBuffer: any[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private sequenceNumber = 0;
  private isTransitioning = false;
  
  constructor(private deploymentId: string, private sendProgress: Function) {}
  
  private scheduleBatchUpdate() {
    if (this.batchTimeout) return;
    
    this.batchTimeout = setTimeout(() => {
      this.flushEventBuffer();
    }, 100); // 100ms debounce
  }
  
  private flushEventBuffer() {
    if (this.eventBuffer.length === 0) return;
    
    // Send single batched event with all files
    if (this.eventBuffer.some(e => e.type === 'code-generation')) {
      const codeGenEvents = this.eventBuffer.filter(e => e.type === 'code-generation');
      const allFiles = codeGenEvents.flatMap(e => e.files || []);
      
      if (allFiles.length > 0) {
        const batchedEvent = {
          type: 'code-generation-batch',
          deploymentId: this.deploymentId,
          stage: 'code-gen',
          files: allFiles,
          timestamp: Date.now(),
          sequence: ++this.sequenceNumber
        };
        
        console.log(`[PROGRESS-MGR] Sending batched code generation with ${allFiles.length} files`);
        this.sendProgress(batchedEvent);
      }
    }
    
    // Send other events
    this.eventBuffer.filter(e => e.type !== 'code-generation').forEach(event => {
      this.sendProgress(event);
    });
    
    // Clear buffer and timeout
    this.eventBuffer = [];
    this.batchTimeout = null;
  }
  
  async transitionToStage(stage: string, message: string): Promise<void> {
    if (this.isTransitioning) {
      await new Promise(resolve => setTimeout(resolve, 50));
      return this.transitionToStage(stage, message);
    }
    
    this.isTransitioning = true;
    
    try {
      // Complete current stage before transitioning
      if (this.currentStage && this.currentStage !== stage) {
        console.log(`[PROGRESS-MGR] Completing stage: ${this.currentStage}`);
        this.stageProgress.set(this.currentStage, 100);
        this.sendProgress({
          stage: this.currentStage,
          status: 'completed',
          message: `${this.currentStage} complete`,
          pct: 100,
          sequence: ++this.sequenceNumber
        });
        
        // Brief pause for UI to process completion
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Start new stage
      console.log(`[PROGRESS-MGR] Starting stage: ${stage}`);
      this.currentStage = stage;
      this.stageProgress.set(stage, 0);
      
      this.sendProgress({
        stage,
        status: 'active',
        message,
        pct: 0,
        sequence: ++this.sequenceNumber
      });
    } finally {
      this.isTransitioning = false;
    }
  }
  
  updateProgress(stage: string, pct: number, message: string, extraData: any = {}) {
    if (this.currentStage !== stage) return;
    
    // Never send lower progress for the same stage
    const lastPct = this.stageProgress.get(stage) || 0;
    const newPct = Math.max(pct, lastPct);
    this.stageProgress.set(stage, newPct);
    
    console.log(`[PROGRESS-MGR] ${stage}: ${lastPct}% → ${newPct}% (${message})`);
    
    this.sendProgress({
      stage,
      status: 'active',
      message,
      pct: newPct,
      sequence: ++this.sequenceNumber,
      ...extraData
    });
  }
  
  addCodeGenerationEvent(fileName: string, content: string) {
    // Add to batch buffer instead of sending immediately
    this.eventBuffer.push({
      type: 'code-generation',
      fileName,
      content,
      files: [{ filename: fileName, content, language: this.getLanguageFromFilename(fileName) }]
    });
    
    // Schedule batched update
    this.scheduleBatchUpdate();
  }
  
  private getLanguageFromFilename(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'rs': 'rust',
      'ts': 'typescript',
      'js': 'javascript',
      'json': 'json',
      'toml': 'toml',
      'yml': 'yaml',
      'yaml': 'yaml'
    };
    return langMap[ext || ''] || 'text';
  }
  
  async completeStage(stage: string, message: string) {
    // Flush any pending events first
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.flushEventBuffer();
    }
    
    this.stageProgress.set(stage, 100);
    this.sendProgress({
      stage,
      status: 'completed',
      message,
      pct: 100,
      sequence: ++this.sequenceNumber
    });
  }
  
  cleanup() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.flushEventBuffer();
    }
  }
}
// ──────────────────────────────────────────────────────────────

// TODO: chunk really large fileTree payloads (> ~16 MB) – Chrome drops giant SSE frames.

const MAX_BUILD_MINUTES = Number(process.env.MAX_BUILD_MINUTES) || 15;

interface PipelineArgs {
  projectId: string;
  userId: string;
  graph: Graph; 
  sendProgress: (data: unknown) => void;
  walletSigned?: boolean;
  devMode?: boolean;
}

/* Helper: ensure web/.env (or .env.local) contains the compiled PID */
async function writeProgramIdEnv(programId: string, absRoot: string) {
  const fs = await import("fs/promises");
  const path = await import("path");
  const candidates = [
    path.join(absRoot, "web", ".env"),
    path.join(absRoot, ".env"),
    path.join(absRoot, "web", ".env.local"),
    path.join(absRoot, ".env.local"),
  ];
  let target: string | null = null;
  for (const p of candidates) {
    try { await fs.access(p); target = p; break; } catch { /* not there */ }
  }
  if (!target) {
    target = path.join(absRoot, "web", ".env");
    await fs.writeFile(target, "");
  }
  let envText = await fs.readFile(target!, "utf8");
  envText = envText
    .replace(/^NEXT_PUBLIC_PROGRAM_ID=.*/m, "")
    .replace(/\n{2,}/g, "\n")
    .trimEnd() + `\nNEXT_PUBLIC_PROGRAM_ID=${programId}\n`;
  await fs.writeFile(target!, envText);
}

export async function runDeployPipeline({
  projectId,
  userId,
  graph,
  sendProgress,
  walletSigned = false,
  devMode = false,
}: PipelineArgs): Promise<void> {
  let programKeypair: Keypair | null = null;
  let programIdStr: string | null = null;
  
  // Reset progress tracking to prevent wobbling
  resetProgress();
  
  // Create progress manager to coordinate stages
  const progressMgr = new ProgressManager(projectId, sendProgress);
  
  // Start environment setup with smooth progress
  const environmentPromise = sendEnvironmentProgress(sendProgress);

  // declare outside try so `finally` can see it
  let workspace: WorkspaceHandle | null = null;
  // Keep-alive interval for SSE connection
  let keepAliveInterval: NodeJS.Timeout | null = null;

  try {
    workspace = await prepEnv(projectId, userId, devMode);

    // Wait for environment progress animation to complete
    await environmentPromise;

    sendProgress(<ProgressEvent>{
      stage: "environment",
      status: "completed",
      message: "Container is up",
      pct: 100,
      containerUrl: workspace.containerUrl
    });
    
    // Keep SSE connection alive
    keepAliveInterval = setInterval(() => {
      sendProgress({ stage: "ping" });
    }, 15000);
 
    
    // 2 ─ code generation ─────────────────────────────────────────────────
    console.log('[DEPLOY] Starting code generation phase with managed progress');
    await progressMgr.transitionToStage('code-gen', '🦀 Starting Solana program generation...');
    
    // Enhanced progress wrapper with batching
    const managedProgressWrapper = (data: any) => {
      if (data.type === 'code-generation' && data.fileName && data.content) {
        // Add individual files to batch instead of sending immediately
        console.log('[DEPLOY] Batching code-generation file:', data.fileName);
        progressMgr.addCodeGenerationEvent(data.fileName, data.content);
      } else if (data.pct && data.stage) {
        progressMgr.updateProgress(data.stage, data.pct, data.message, data);
      } else {
        sendProgress(data);
      }
    };
    
    const { sentinelId, programName } =
          await handleGenerateCode({ projectId, graph, workspace, sendProgress: managedProgressWrapper, userId });

    // ✅ Code generation is done – **re‑use** the deterministic key‑pair that
    // was written during code‑gen. Never generate a second one.
    const projectFolder =
      workspace.rootPath ??
      (await import("../fileUtils").then(m => m.getProjectRootPath(projectId)));

    // Read the existing keypair JSON from the warm‑cache
    const keypairPath = `/usr/src/target/deploy/${programName}-keypair.json`;
    const secretJson  = execSync(
      `docker exec ${workspace.containerName} cat '${keypairPath}'`,
      { encoding: "utf8" }
    ).trim();

    const secretArr   = JSON.parse(secretJson);
    programKeypair    = Keypair.fromSecretKey(Uint8Array.from(secretArr));
    programIdStr      = programKeypair.publicKey.toBase58();
    // Complete code generation stage
    await progressMgr.completeStage('code-gen', `Code generation complete — Program ID: ${programIdStr}`);

    /* 3 ─ build program --------------------------------------------------- */
    
    // wait until all src + UI files are on disk
    // allow up to 3 min for large repos (90 × 2 s)
    await waitForTaskCompletion(sentinelId, 90, 2_000);
    
    // Start build phase with atomic transition
    console.log('[DEPLOY] Starting build phase with managed progress');
    await progressMgr.transitionToStage('build', 'Starting Rust compilation...');
    const buildPromise = sendBuildProgress(sendProgress);
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
      // projectFolder is already defined earlier (after code‑gen); reuse it here.

      // Smooth build progress continues in background

      // One-liner executed *inside* the running container
      const linkCmd = [
        `cd /usr/src/${projectFolder}`,
        'rm -rf target/deploy',                // remove accidental dir, if any
        'mkdir -p target',
        // -T treats DEST as a file so ln never creates "deploy/deploy"
        'ln -sfnT /usr/src/target/deploy target/deploy',
        '[ ! -e target/idl ] && ln -sfnT /usr/src/target/deploy target/idl || true'
      ].join(" && ");

      // Generate a unique task ID for the symlink command
      const symlinkTaskId = `symlink-${projectId}-${Date.now()}`;
      
      // `runCommand` already wraps child_process.exec for you
      await runCommand(`docker exec ${workspace.containerName} bash -c '${linkCmd}'`,
                       ".", symlinkTaskId, { skipSuccessUpdate: true });
    }
    
    console.log("🔨 Build task completed successfully");

    /* 3b ─ fetch artefact ------------------------------------------------ */
    const { base64So } = await getBuildArtifactTask(projectId);
    if (!base64So) {
      throw new Error('Anchor built with warnings but produced no .so – check build log');
    }
    
    /* ---------------------------------------------------------------- *
     * 3c ─ build finished → gather file-tree with eager code
     * ---------------------------------------------------------------- */
    // Wait for build progress animation to complete
    await buildPromise;

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
    
    // (4)  Copy **only the artefacts we actually need**:
    //      ▸   compiled .so & .idl  under  /usr/src/target/deploy
    //      ▸   Anchor.toml  (for network + IDs)
    //      Anything else (node_modules, .next, yarn releases) is skipped
    //      to keep the tar stream < 5 MB and avoid ENOBUFS.
    // ------------------------------------------------------------------
    // projectFolder is already defined earlier (after code‑gen); reuse it here.

    const deployDir = `/usr/src/${projectFolder}/target/deploy`;
    const idlDirs   : string[] = [
      `/usr/src/${projectFolder}/target/idl`,       // classic location
      `/usr/src/${projectFolder}/target/deploy`,    // Anchor ≥0.30 drops JSON here
    ];
    const tomlFile  = `/usr/src/${projectFolder}/Anchor.toml`;

    /* ── NEW: copy only the artefacts we really need ─────────────────────────
     * NEVER copy `${programName}-keypair.json`; it contains the 64‑byte secret
     * key and must stay inside the container.
     * ----------------------------------------------------------------------*/
    await readContainerFile(
      workspace.containerName,
      path.posix.join(deployDir, `${programName}.so`),   // compiled program
      projectId,
      userId
    );
    await readContainerFile(workspace.containerName, tomlFile, projectId, userId);

    /* ── NEW: copy only the artefacts we really need ─────────────────────────
     * NEVER copy `${programName}-keypair.json`; it contains the 64‑byte secret
     * key and must stay inside the container.
     * ----------------------------------------------------------------------*/
    await readContainerFile(
      workspace.containerName,
      path.posix.join(deployDir, `${programName}.so`),   // compiled program
      projectId,
      userId
    );
    await readContainerFile(workspace.containerName, tomlFile, projectId, userId);

    /* ----------------------------------------------------------------
       Copy every *.json found under each IDL dir instead of trying to
       stream the directory itself (which triggers "cat: … Is a directory")
       ---------------------------------------------------------------- */
    for (const d of idlDirs) {
      try {
        await runCommand(
          `docker exec ${workspace.containerName} bash -c 'shopt -s nullglob && for f in "${d}"/*.json; do cat "$f"; done'`,
          ".",
          `copy-idl-${Date.now()}`,
          { skipSuccessUpdate: true },
        );
      } catch { /* dir may not exist – fine */ }
    }

    /* ---- host copy removed: program ID is read in-container below ---- */
    
    // Modify attachFileContents to skip logging content but still send real content to frontend
    const skipContentLogging = true; // Don't log file contents to console
    await attachFileContents(rawTree, absRoot, workspace.containerName, false, skipContentLogging);
    const fileTree = rawTree;  // now populated with actual content for frontend

    /* Program ID was determined pre-build */
    const programId = programIdStr!;

    /* ------------------------------------------------------------------
       Always write the Program ID to web/.env – the previous logic only
       did this when an IDL was detected.  Extracted into a helper so it
       runs before we emit build-done.
       ------------------------------------------------------------------ */
    await writeProgramIdEnv(programId, absRoot);

    // 📌  Make the env file visible to the Next.js dev server
    await runCommand(
      `docker exec ${workspace.containerName} bash -c ` +
      `'cp ${path.posix.join("/usr/src", workspace.rootPath, "web/.env")} /usr/share/solanaflow/web/.env'`,
      ".",
      uuidv4(),
      { skipSuccessUpdate: true }
    );

    /* finally emit build‑done with artefact + file tree */
    let idlContent: any = null;
    const idls: any[] = [];
    
    const findIdls = (nodes: any[]): void => {
      for (const node of nodes) {
        if (
          node.type === 'file' &&
          node.name.endsWith('.json') &&
          /**
           * Inside the running container the absolute path is
           *   /usr/src/target/idl/<program>.json
           * After we copy it into `rawTree` the path is *relative*
           *   target/idl/<program>.json
           * so we must allow both variants.
           */
          (node.path?.includes('/target/idl/') ||
           node.path?.includes('target/idl/')) &&
          !node.name.endsWith('-keypair.json')
        ) {
          try {
            const content = node.content ? JSON.parse(node.content) : null;
            if (content) {
              idls.push(content);
              // Use the first IDL as the primary one
              if (!idlContent) {
                idlContent = content;
              }
            }
          } catch {
            // Skip invalid IDL files
          }
        }
        if (node.children) {
          findIdls(node.children);
        }
      }
    };
    
    findIdls(fileTree);
    console.log(`📋 Found ${idls.length} IDL file(s)`);
    
    /* ──────────────────────────────────────────────────────────────
     * Patch   idl.metadata.address  →  compiled program public key
     * so the front-end can safely use  new anchor.Program(idl, provider)
     * (Anchor ≥ 0.30 expects this field to be correct).
     * ────────────────────────────────────────────────────────────── */
    if (idlContent) {
      try {
        // Program ID was already determined above
        const programId = programIdStr!;

        idlContent.metadata = {
          ...(idlContent.metadata ?? {}),
          address: programId,
        };
        console.log(`🔑 Updated IDL metadata with program ID: ${programId}`);

        /* ---------- ensure the front-end sees the Program ID ---------- */
        try {
          await writeProgramIdEnv(programId, absRoot);
          console.log(`📄 Program ID written to .env file`);

          /* ----------------------------------------------------------
           * The file change happens *after* the Next.js dev server
           * is already running inside the container.  Restart once
           * so the server reloads the updated env vars.
           * --------------------------------------------------------- */
          try {
            await runCommand(
              `docker restart ${workspace.containerName}`,
              ".",                    // run from repo root
              uuidv4(),               // fresh task-ID
              { skipSuccessUpdate: true }   // don't spam progress
            );
          } catch (restartErr) {
            console.warn(`⚠️  Container restart failed: ${restartErr}`);
          }
        } catch (envErr) {
          console.warn(`⚠️  .env write failed: ${envErr}`);
        }
      } catch (err) {
        console.warn(`⚠️  IDL metadata patch failed: ${err}`);
      }
    }
    
    sendProgress(<ProgressEvent>{
      stage   : "build",
      status  : "completed",
      message : "Build finished",
      pct     : 100,
      artifact: base64So,
      fileTree,
      ...(idlContent ? { idl: idlContent } : {}),
      ...(idls.length > 0 ? { idls } : {}),
      programId: programIdStr,
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
     * Cleanup progress manager and container
     * ---------------------------------------------------------------- */
    progressMgr.cleanup();
    
    if (workspace) {
      await markContainerForCleanup(projectId, workspace.containerName);
    }
    
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
    }
  }
}

