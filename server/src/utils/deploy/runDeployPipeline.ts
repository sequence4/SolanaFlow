import { prepEnv } from '../container/prepEnv';
import type { WorkspaceHandle } from '../container/prepEnv';
import { handleGenerateCode } from "../codeGen/handleGenerateCode";
import { markContainerForCleanup } from "../container/cleanupQueue";
import { getBuildArtifactTask } from "../anchor/getBuildArtefactTask";
import { startAnchorBuildTask } from "../anchor/startAnchorBuildTask";
import { runCommand } from "../command-execution/runCommand";
import { waitForTaskCompletion } from "../taskUtils";
import path from "path";
import { execSync } from "child_process"; 
import { Keypair } from "@solana/web3.js";
import { attachFileContents } from "../fileUtils/attachFileContents";
import { readContainerFile } from "../fileUtils/attachFileContents";
import { v4 as uuidv4 } from "uuid";
import { sendEnvironmentProgress, sendBuildProgress, resetProgress } from "../progress/progressUtils";
import { MAX_BUILD_MINUTES, PipelineArgs } from './data';


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
  private generatedFiles: any[] = [];
  private collectedFiles = 0;
  private expectedCollectionFiles = 10;
  private currentTasks: Map<string, {name: string, status: 'running' | 'completed' | 'error', pct: number}> = new Map();
  
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
        
        //console.log(`[PROGRESS-MGR] Sending batched code generation with ${allFiles.length} files`);
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
        //console.log(`[PROGRESS-MGR] Completing stage: ${this.currentStage}`);
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
      //console.log(`[PROGRESS-MGR] Starting stage: ${stage}`);
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
    
    //console.log(`[PROGRESS-MGR] ${stage}: ${lastPct}% → ${newPct}% (${message})`);
    
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
    this.generatedFiles.push({ fileName, content });
    
    const expectedFiles = 20; 
    const baseProgress = Math.min((this.generatedFiles.length / expectedFiles) * 40, 40);
    
    const processingProgress = Math.min(30, this.generatedFiles.length * 1.5);
    
    const totalProgress = Math.min(70, baseProgress + processingProgress);
        
    this.sendProgress({
      type: 'file-generated',
      stage: 'code-gen',
      fileName,
      content: content, 
      fileIndex: this.generatedFiles.length,
      totalFiles: this.generatedFiles.length,
      pct: totalProgress,
      timestamp: Date.now(),
      sequence: ++this.sequenceNumber,
      language: this.getLanguageFromFilename(fileName) // Include language
    });
  }
  
  async handleFileCollection(fileName: string, success: boolean) {
    this.collectedFiles++;
    
    // More gradual progress from 70% to 95%
    const baseProgress = 70;
    const maxProgress = 95;
    const progressRange = maxProgress - baseProgress;
    
    // Use logarithmic curve for smoother progression
    const progressRatio = Math.log(this.collectedFiles + 1) / Math.log(this.expectedCollectionFiles + 1);
    const collectionProgress = baseProgress + (progressRange * Math.min(1, progressRatio));
    
    this.updateProgress('code-gen', Math.round(collectionProgress), 
      success ? `Verified: ${fileName}` : `Processing: ${fileName}`);
    
    // Smaller delay for smoother updates
    await new Promise(resolve => setTimeout(resolve, 50));
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
  
  // Add new method for individual task tracking
  startTask(taskId: string, taskName: string, stage: string) {
    this.currentTasks.set(taskId, {name: taskName, status: 'running', pct: 0});
    this.sendProgress({
      type: 'task-start',
      taskId,
      taskName,
      stage,
      status: 'running',
      timestamp: Date.now(),
      sequence: ++this.sequenceNumber
    });
  }
  
  updateTask(taskId: string, pct: number, message?: string) {
    const task = this.currentTasks.get(taskId);
    if (task) {
      task.pct = pct;
      this.sendProgress({
        type: 'task-update',
        taskId,
        taskName: task.name,
        pct,
        message,
        status: 'running',
        timestamp: Date.now(),
        sequence: ++this.sequenceNumber
      });
    }
  }
  
  completeTask(taskId: string, message?: string) {
    const task = this.currentTasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.pct = 100;
      this.sendProgress({
        type: 'task-complete',
        taskId,
        taskName: task.name,
        pct: 100,
        message: message || `${task.name} completed`,
        status: 'completed',
        timestamp: Date.now(),
        sequence: ++this.sequenceNumber
      });
    }
  }

  cleanup() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.flushEventBuffer();
    }
  }
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
  devMode = false,
}: PipelineArgs): Promise<void> {
  let programKeypair: Keypair | null = null;
  let programIdStr: string | null = null;
  
  console.log("[PIPELINE] Starting deployment pipeline");
  console.log(`[PIPELINE] Project: ${projectId}`);
  console.log(`[PIPELINE] User: ${userId}`);
  console.log(`[PIPELINE] Development mode: ${devMode}`);
  
  resetProgress();
  const progressMgr = new ProgressManager(projectId, sendProgress);
  console.log("[PIPELINE] Initializing environment setup");
  const environmentPromise = sendEnvironmentProgress(sendProgress);
  let workspace: WorkspaceHandle | null = null;
  let keepAliveInterval: NodeJS.Timeout | null = null;

  try {
    console.log("[ENVIRONMENT] Setting up Docker environment");
    progressMgr.startTask('env-docker', 'Docker Environment Setup', 'environment');
    workspace = await prepEnv(projectId, userId, devMode);
    console.log(`[ENVIRONMENT] Container ready: ${workspace.containerName}`);
    progressMgr.completeTask('env-docker', 'Container ready');
    await environmentPromise;
    console.log("[ENVIRONMENT] Environment setup complete");
    sendProgress(<ProgressEvent>{
      stage: "environment",
      status: "completed",
      message: "Container is up",
      pct: 100,
      containerUrl: workspace.containerUrl
    });
    
    keepAliveInterval = setInterval(() => {
      sendProgress({ type: "ping", stage: "keepalive", message: "Connection maintained" });
    }, 30000);
 
    
    console.log("[CODE-GEN] Starting code generation phase");
    await progressMgr.transitionToStage('code-gen', 'Starting Solana program generation');
    
    console.log("[CODE-GEN] Analyzing project structure");
    progressMgr.startTask('codegen-analyze', 'Analyzing Project Structure', 'code-gen');
    progressMgr.updateTask('codegen-analyze', 25, 'Parsing graph structure...');
    progressMgr.completeTask('codegen-analyze');
    
    console.log("[CODE-GEN] Generating Rust program files");
    progressMgr.startTask('codegen-rust', 'Generating Rust Program', 'code-gen');
    console.log("[CODE-GEN] Generating frontend TypeScript bindings");
    progressMgr.startTask('codegen-frontend', 'Generating Frontend Code', 'code-gen');
    
    // Enhanced progress wrapper with individual file tracking
    const managedProgressWrapper = (data: any) => {
      // Handle code-generation events with files array
      if (data.type === 'code-generation' && data.files && Array.isArray(data.files)) {
        //console.log('[DEPLOY] Processing code-generation batch with', data.files.length, 'files');
        /*
        console.log('[DEPLOY] CRITICAL: First file in batch:', {
          filename: data.files[0]?.filename,
          hasContent: !!data.files[0]?.content,
          contentLength: data.files[0]?.content?.length || 0,
          contentSample: data.files[0]?.content?.substring(0, 100) || 'NO CONTENT'
        });
        */
        
        // Send individual file events for each file in the batch
        data.files.forEach((file: any) => {
          if (file.filename && file.content) {
            //console.log(`[DEPLOY] Processing file from batch:`, file.filename, 'content length:', file.content.length);
            progressMgr.addCodeGenerationEvent(file.filename, file.content);
            
            // Update specific task progress based on file type
            if (file.filename.endsWith('.rs')) {
              progressMgr.updateTask('codegen-rust', Math.min(90, (data.files.filter((f: any) => f.filename.endsWith('.rs')).length / data.files.length) * 100));
            } else if (file.filename.endsWith('.tsx') || file.filename.endsWith('.ts')) {
              progressMgr.updateTask('codegen-frontend', Math.min(90, (data.files.filter((f: any) => f.filename.endsWith('.tsx') || f.filename.endsWith('.ts')).length / data.files.length) * 100));
            }
          } 
        });
        
        // Also send the overall progress update
        if (data.pct && data.stage) {
          progressMgr.updateProgress(data.stage, data.pct, data.message, data);
        }
      } 
      // Handle individual file-generated events
      else if ((data.type === 'code-generation' || data.type === 'file-generated') && data.fileName) {
        // Send individual file generation events immediately
        //console.log('[DEPLOY] Processing individual file generation:', data.fileName, 'has content:', !!data.content);
        
        // Ensure content is passed through
        const fileContent = data.content || data.fileContent || '';
        progressMgr.addCodeGenerationEvent(data.fileName, fileContent);
      } 
      // Handle general progress updates
      else if (data.pct && data.stage) {
        progressMgr.updateProgress(data.stage, data.pct, data.message, data);
      } 
      // Pass through other events
      else {
        sendProgress(data);
      }
    };
    
    console.log("[CODE-GEN] Executing code generation");
    const { sentinelId, programName } =
          await handleGenerateCode({ projectId, graph, workspace, sendProgress: managedProgressWrapper, userId });

    console.log(`[CODE-GEN] Code generation completed for program: ${programName}`);
    console.log(`[CODE-GEN] Sentinel task ID: ${sentinelId}`);

    // ✅ Code generation is done – **re‑use** the deterministic key‑pair that
    // was written during code‑gen. Never generate a second one.
    const projectFolder =
      workspace.rootPath ??
      (await import("../fileUtils").then(m => m.getProjectRootPath(projectId)));

    console.log("[CODE-GEN] Reading program keypair");
    // Read the existing keypair JSON from the warm‑cache
    const keypairPath = `/usr/src/target/deploy/${programName}-keypair.json`;
    const secretJson  = execSync(
      `docker exec ${workspace.containerName} cat '${keypairPath}'`,
      { encoding: "utf8" }
    ).trim();

    const secretArr   = JSON.parse(secretJson);
    programKeypair    = Keypair.fromSecretKey(Uint8Array.from(secretArr));
    programIdStr      = programKeypair.publicKey.toBase58();
    console.log(`[CODE-GEN] Program ID determined: ${programIdStr}`);
    
    // Complete individual code generation tasks
    progressMgr.completeTask('codegen-rust');
    progressMgr.completeTask('codegen-frontend');
    
    console.log("[CODE-GEN] Code generation stage completed");
    // Complete code generation stage
    await progressMgr.completeStage('code-gen', `Code generation complete — Program ID: ${programIdStr}`);

    /* 3 ─ build program --------------------------------------------------- */
    
    console.log("[BUILD] Waiting for all files to be written to disk");
    // wait until all src + UI files are on disk
    // allow up to 3 min for large repos (90 × 2 s)
    await waitForTaskCompletion(sentinelId, 90, 2_000);
    
    console.log("[BUILD] Starting build phase");
    // Start build phase with atomic transition
    await progressMgr.transitionToStage('build', 'Starting Rust compilation...');
    
    // Build with individual tasks
    console.log("[BUILD] Setting up build tasks");
    progressMgr.startTask('build-deps', 'Installing Dependencies', 'build');
    progressMgr.startTask('build-compile', 'Compiling Rust to BPF', 'build');
    progressMgr.startTask('build-artifacts', 'Generating Artifacts', 'build');
    
    console.log("[BUILD] Starting Anchor build process");
    const buildPromise = sendBuildProgress(sendProgress);
    const buildTask = await startAnchorBuildTask(projectId, userId);
    console.log(`[BUILD] Build task started: ${buildTask}`);
    
    // Compute retry count based on configured build timeout
    const buildMinutes = MAX_BUILD_MINUTES;
    const buildRetries = Math.ceil(buildMinutes * 60_000 / 2_000);
    console.log(`[BUILD] Build timeout: ${buildMinutes} minutes (${buildRetries} retries)`);
    
    // Check build status and bail early if not successful
    console.log("[BUILD] Waiting for build completion");
    const buildStatus = await waitForTaskCompletion(buildTask, buildRetries, 2_000);
    console.log(`[BUILD] Build completed with status: ${buildStatus}`);
    
    const OK_STATUSES = ['succeed', 'finished', 'warning']; // Anchor warns but succeeds
    if (!OK_STATUSES.includes(buildStatus)) {
      console.error(`[BUILD] Build failed with status: ${buildStatus}`);
      throw new Error(`Build task ended with status: ${buildStatus}`);
    }
    
    console.log("[BUILD] Completing build tasks");
    // Complete individual build tasks
    progressMgr.completeTask('build-deps', 'Dependencies installed');
    progressMgr.completeTask('build-compile', 'Rust compilation completed');
    progressMgr.completeTask('build-artifacts', 'Build artifacts generated');
    
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
    
    //console.log("🔨 Build task completed successfully");

    /* 3b ─ fetch artefact ------------------------------------------------ */
    console.log("[ARTIFACTS] Fetching build artifacts");
    const { base64So } = await getBuildArtifactTask(projectId);
    if (!base64So) {
      console.error("[ARTIFACTS] No .so file found after build");
      throw new Error('Anchor built with warnings but produced no .so – check build log');
    }
    console.log("[ARTIFACTS] Build artifact retrieved successfully");
    
    /* ---------------------------------------------------------------- *
     * 3c ─ build finished → gather file-tree with eager code
     * ---------------------------------------------------------------- */
    // Wait for build progress animation to complete
    await buildPromise;

    console.log("[FILE-TREE] Generating project file tree");
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
    console.log(`[FILE-TREE] Generated file tree with ${rawTree.length} root items`);

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

    /* ── Enhanced file collection with existence checking and retries ──────────
     * NEVER copy `${programName}-keypair.json`; it contains the 64‑byte secret
     * key and must stay inside the container.
     * ----------------------------------------------------------------------*/
    //console.log('[FILE-OPS] Starting file collection phase');
    //console.log('[FILE-OPS] Project folder:', projectFolder);
    //console.log('[FILE-OPS] Deploy directory:', deployDir);
    
    // Helper functions for file operations
    const checkFileExists = async (containerName: string, filePath: string): Promise<boolean> => {
      try {
        const result = execSync(
          `docker exec ${containerName} test -f "${filePath}" && echo "exists" || echo "missing"`,
          { encoding: 'utf8' }
        ).trim();
        return result === 'exists';
      } catch (error) {
        console.error(`[FILE-CHECK] Error checking file ${filePath}:`, error);
        return false;
      }
    };
    
    const listDirectory = async (containerName: string, dirPath: string) => {
      try {
        const files = execSync(
          `docker exec ${containerName} ls -la "${dirPath}" 2>/dev/null || echo "Directory not found"`,
          { encoding: 'utf8' }
        );
        //console.log(`[DIR-LISTING] Contents of ${dirPath}:\n${files}`);
        return files;
      } catch (error) {
        console.error(`[DIR-LISTING] Error listing ${dirPath}:`, error);
        return null;
      }
    };
    
    // List the deploy directory to see what's actually there
    await listDirectory(workspace.containerName, deployDir);
    
    // Check for .so file with retries
    const soFilePath = path.posix.join(deployDir, `${programName}.so`);
    let soFileExists = false;
    let retryCount = 0;
    
    while (!soFileExists && retryCount < 5) {
      soFileExists = await checkFileExists(workspace.containerName, soFilePath);
      if (!soFileExists) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        retryCount++;
      }
    }
    
    if (soFileExists) {
      await readContainerFile(
        workspace.containerName,
        soFilePath,
        projectId,
        userId
      );
    }
    
    // Check for Anchor.toml with fallback
    const tomlExists = await checkFileExists(workspace.containerName, tomlFile);
    if (tomlExists) {
      await readContainerFile(workspace.containerName, tomlFile, projectId, userId);
    }
    
    // Collect additional project files for file tree
    const additionalFiles = [
      { path: `${projectFolder}/src/lib.rs`, name: 'lib.rs' },
      { path: `${projectFolder}/web/package.json`, name: 'package.json' },
      { path: `${projectFolder}/web/src/App.tsx`, name: 'App.tsx' },
      { path: `${projectFolder}/web/src/App.css`, name: 'App.css' },
      { path: `${projectFolder}/README.md`, name: 'README.md' }
    ];
    
    for (const file of additionalFiles) {
      try {
        const exists = await checkFileExists(workspace.containerName, file.path);
        if (exists) {
          await readContainerFile(workspace.containerName, file.path, projectId, userId);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        // Skip failed files
      }
    }

    /* ----------------------------------------------------------------
       Copy every *.json found under each IDL dir with better error handling
       ---------------------------------------------------------------- */
    for (const d of idlDirs) {
      try {
        //console.log(`[IDL-COPY] Checking directory: ${d}`);
        await listDirectory(workspace.containerName, d);
        
        await runCommand(
          `docker exec ${workspace.containerName} bash -c 'shopt -s nullglob && for f in "${d}"/*.json; do echo "Found: $f" && cat "$f" 2>/dev/null || echo "Failed to read: $f"; done'`,
          ".",
          `copy-idl-${Date.now()}`,
          { skipSuccessUpdate: true },
        );
      } catch (err) {
        console.log(`[IDL-COPY] Directory ${d} not accessible:`, err);
      }
    }
    
    // Final phase of code generation
    progressMgr.updateProgress('code-gen', 98, 'Finalizing code generation...');
    await new Promise(resolve => setTimeout(resolve, 500));
    progressMgr.updateProgress('code-gen', 100, 'Code generation complete!');
    
    // Update build progress separately
    progressMgr.updateProgress('build', 99, 'Finalizing build artifacts...');

    /* ---- host copy removed: program ID is read in-container below ---- */
    
    // Pre-filter file tree to reduce processing overhead  
    const filterFileTree = (nodes: any[]): any[] => {
      const HEAVY_DIRS = new Set(['.next', 'node_modules', '.yarn', '.git', 'target/debug', 'target/release', '.turbo']);
      
      return nodes.map(node => {
        if (node.type === 'directory') {
          // Skip heavyweight directories by clearing their children
          if (HEAVY_DIRS.has(node.name)) {
            return { ...node, children: [] }; // Keep directory but no children
          }
          // Recursively filter children
          if (node.children) {
            return { ...node, children: filterFileTree(node.children) };
          }
        }
        return node;
      }).filter(Boolean);
    };

    // Filter the tree before attaching contents to dramatically reduce processing
    const filteredTree = filterFileTree(rawTree);
    //console.log(`[PERF] Filtered file tree from ${JSON.stringify(rawTree).length} to ${JSON.stringify(filteredTree).length} chars`);
    
    // Modify attachFileContents to skip logging content but still send real content to frontend
    const skipContentLogging = true; // Don't log file contents to console
    await attachFileContents(filteredTree, absRoot, workspace.containerName, false, skipContentLogging);
    const fileTree = filteredTree;  // now populated with actual content for frontend

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
    //console.log(`📋 Found ${idls.length} IDL file(s)`);
    
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
        //console.log(`🔑 Updated IDL metadata with program ID: ${programId}`);

        /* ---------- ensure the front-end sees the Program ID ---------- */
        try {
          await writeProgramIdEnv(programId, absRoot);
          //console.log(`📄 Program ID written to .env file`);

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
    
    console.log("[PIPELINE] Build stage completed successfully");
    console.log(`[PIPELINE] Final program ID: ${programIdStr}`);
    console.log(`[PIPELINE] Found ${idls.length} IDL files`);
    console.log("[PIPELINE] Deployment pipeline completed successfully");
    
    // Complete the build stage properly
    await progressMgr.completeStage('build', `Build finished successfully - Program ID: ${programIdStr}`);
    
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

    // Send pipeline completion event for frontend
    console.log("[PIPELINE] Sending pipeline completion event");
    sendProgress({
      type: 'pipeline-complete',
      stage: 'build',
      status: 'completed',
      message: 'Deployment pipeline completed successfully',
      programId: programIdStr,
      timestamp: Date.now()
    });

  } catch (err) {
    console.error("[PIPELINE] Deployment pipeline failed");
    console.error("[PIPELINE] Error:", err instanceof Error ? err.message : String(err));
    
    sendProgress(<ProgressEvent>{
      stage: "error",
      status: "error",
      message: err instanceof Error ? err.message : String(err)
    });
    throw err;
  } finally {
    console.log("[PIPELINE] Starting cleanup");
    /* ----------------------------------------------------------------
     * Cleanup progress manager and container
     * ---------------------------------------------------------------- */
    progressMgr.cleanup();
    
    if (workspace) {
      console.log(`[PIPELINE] Marking container for cleanup: ${workspace.containerName}`);
      await markContainerForCleanup(projectId, workspace.containerName);
    }
    
    if (keepAliveInterval) {
      console.log("[PIPELINE] Clearing keep-alive interval");
      clearInterval(keepAliveInterval);
    }
    
    console.log("[PIPELINE] Cleanup completed");
  }
}

