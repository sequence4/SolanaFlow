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
import fs from "fs/promises";
import { execSync } from "child_process"; 
import { PublicKey } from "@solana/web3.js";
import { attachFileContents } from "../fileUtils/attachFileContents";
import { readContainerFile } from "../fileUtils/attachFileContents";
import { v4 as uuidv4 } from "uuid";

// ─── unified progress payload ────────────────────────────
interface ProgressEvent {
  stage : "environment" | "code-gen" | "build" | "error";
  status: "active" | "completed" | "error";
  message: string;
  pct?: number;
  [k: string]: unknown;      
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
  sendProgress(<ProgressEvent>{
    stage: "environment",
    status: "active",
    message: "Preparing your build environment…"
  });

  // declare outside try so `finally` can see it
  let workspace: WorkspaceHandle | null = null;
  // Keep-alive interval for SSE connection
  let keepAliveInterval: NodeJS.Timeout | null = null;

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
    
    // Start a keep-alive ping to prevent SSE connection from timing out
    keepAliveInterval = setInterval(() => {
      console.log("[PIPELINE] Sending keep-alive ping");
      sendProgress({ stage: "ping" });
    }, 15000); // Send ping every 15 seconds
 
    
    // 2 ─ code generation ─────────────────────────────────────────────────
    sendProgress(<ProgressEvent>{
      stage: "code-gen",
      status: "active",
      message: "Generating Anchor code…"
    });
    sendProgress({ stage: "code-gen", message: "Generating Anchor code…" });
    const { sentinelId, programName } =
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
        'ln -sfnT /usr/src/target/deploy target/deploy',
        '[ ! -e target/idl ] && ln -sfnT /usr/src/target/deploy target/idl || true'
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
    
    // (4)  Copy **only the artefacts we actually need**:
    //      ▸   compiled .so & .idl  under  /usr/src/target/deploy
    //      ▸   Anchor.toml  (for network + IDs)
    //      Anything else (node_modules, .next, yarn releases) is skipped
    //      to keep the tar stream < 5 MB and avoid ENOBUFS.
    // ------------------------------------------------------------------
    const projectFolder =
      workspace.rootPath ??
      (await import("../fileUtils").then(m => m.getProjectRootPath(projectId)));

    const deployDir = `/usr/src/${projectFolder}/target/deploy`;
    const idlDirs   : string[] = [
      `/usr/src/${projectFolder}/target/idl`,       // classic location
      `/usr/src/${projectFolder}/target/deploy`,    // Anchor ≥0.30 drops JSON here
    ];
    const tomlFile  = `/usr/src/${projectFolder}/Anchor.toml`;

    // ── NEW: copy only the files we really need ────────────────
    for (const file of [`${programName}.so`, `${programName}-keypair.json`]) {
      await readContainerFile(
        workspace.containerName,
        path.posix.join(deployDir, file),   // <-- stay inside the container
        projectId,
        userId
      );
    }
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

    /* -----------------------------------------------------------------
     * Ensure the keypair JSON is actually present on the host filesystem
     * before we try to read it below.  readContainerFile() streams the
     * bytes into a task result only – it does *not* write the file out.
     * ----------------------------------------------------------------- */
    const hostKeypairPath = path.join(
      absRoot,
      "target",
      "deploy",
      `${programName}-keypair.json`,
    );

    try {
      // quick existence check
      await fs.access(hostKeypairPath);
    } catch {
      // If missing, copy it out of the running container
      await fs.mkdir(path.dirname(hostKeypairPath), { recursive: true });

      const copyTaskId = `copy-keypair-${Date.now()}`;
      await runCommand(
        `docker cp ` +
          `${workspace.containerName}:` +
          `${path.posix.join(deployDir, `${programName}-keypair.json`)} ` +
          `${hostKeypairPath}`,
        ".",
        copyTaskId,
        { skipSuccessUpdate: true },
      );
    }
    
    await attachFileContents(rawTree, absRoot, workspace.containerName);
    const fileTree = rawTree;  // now populated

    /* derive programId once – used for IDL patch & env file */
    // ------------------------------------------------------------
    // Always read the key‑pair that Anchor generated **inside** the
    // container, never via a host‑path that may not exist.
    // ------------------------------------------------------------
    const keypairStr = execSync(
      `docker exec ${workspace.containerName} cat ${deployDir}/${programName}-keypair.json`,
      { encoding: "utf8" },
    );
    const secretKey = JSON.parse(keypairStr.trim()) as number[];
    const programId = new PublicKey(secretKey.slice(32)).toBase58();

    /* ------------------------------------------------------------------
       Always write the Program ID to web/.env – the previous logic only
       did this when an IDL was detected.  Extracted into a helper so it
       runs before we emit build-done.
       ------------------------------------------------------------------ */
    await writeProgramIdEnv(programId, absRoot);

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
          } catch (err) {
            console.error(`[pipeline] Failed to parse IDL JSON: ${err}`);
          }
        }
        if (node.children) {
          findIdls(node.children);
        }
      }
    };
    
    findIdls(fileTree);
    console.log(`[pipeline] Found ${idls.length} IDLs`);
    
    /* ──────────────────────────────────────────────────────────────
     * Patch   idl.metadata.address  →  compiled program public key
     * so the front-end can safely use  new anchor.Program(idl, provider)
     * (Anchor ≥ 0.30 expects this field to be correct).
     * ────────────────────────────────────────────────────────────── */
    if (idlContent) {
      try {
        // Re‑read the key‑pair directly from the container so we do
        // not depend on any host‑side copies.
        const keypairStr2 = execSync(
          `docker exec ${workspace.containerName} cat ${deployDir}/${idlContent.name}-keypair.json`,
          { encoding: "utf8" },
        );
        const secretKey = JSON.parse(keypairStr2.trim()) as number[];
        if (secretKey.length !== 64) {
          throw new Error("unexpected keypair length");
        }

        const programId = new PublicKey(secretKey.slice(32)).toBase58(); // last 32 bytes = pubkey

        idlContent.metadata = {
          ...(idlContent.metadata ?? {}),
          address: programId,
        };
        console.log(`[pipeline] Patched IDL metadata.address → ${programId}`);

        /* ---------- ensure the front-end sees the Program ID ---------- */
        try {
          await writeProgramIdEnv(programId, absRoot);
          console.log(`[pipeline] Program ID written to .env file`);

          /* ----------------------------------------------------------
           * The file change happens *after* the Next.js dev server
           * is already running inside the container.  Restart once
           * so the server reloads the updated env vars.
           * --------------------------------------------------------- */
          try {
            if (!process.env.SF_DEV_SERVER) {
              await runCommand(
                `docker restart ${workspace.containerName}`,
                ".",                    // run from repo root
                uuidv4(),               // fresh task-ID
                { skipSuccessUpdate: true }   // don't spam progress
              );
              console.log("[pipeline] Restarted container to reload env vars");
            }
          } catch (restartErr) {
            console.warn(
              `[pipeline] Could not restart container: ${restartErr}`
            );
          }
        } catch (envErr) {
          console.warn(`[pipeline] Failed to write .env(.local): ${envErr}`);
        }
      } catch (err) {
        console.warn(`[pipeline] Could not patch metadata.address automatically: ${err}`);
      }
    }
    
    sendProgress(<ProgressEvent>{
      stage   : "build",
      status  : "completed",
      message : "Build finished",
      artifact: base64So,
      fileTree,
      ...(idlContent ? { idl: idlContent } : {}),
      ...(idls.length > 0 ? { idls } : {}),
      programId,
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
    
    // Clear keep-alive interval
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      console.log("[PIPELINE] Cleared keep-alive interval");
    }
  }
}

