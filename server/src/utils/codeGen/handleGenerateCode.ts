import { refreshWorkspaceTree } from './refreshWorkspaceTree';
import { Graph } from '../../types/graph';
import type { WorkspaceHandle } from '../deploy/prepEnv';
import { amendConfigFiles } from './amendConfigFiles';
import { pollTaskStatus, createTask, updateTaskStatus, waitForTaskCompletion } from '../taskUtils';
import { markWriteDone } from '../taskUtils/index';
import { genSrcFiles } from './genSrcFiles';
import { insertSrcFiles, InsertSrcProgressFn } from './insertSrcFiles';
import { debugDumpContainerTree, debugPrintFiles } from '../containerUtils';
import { ensureAnchorTomlProgram, ensureRootWorkspaceMembers } from './ensureConfigHelpers';
import { parseNodeDetails } from './parseNodeDetails';
import { lintWorkspaceManifests } from './cargoManifestLint';
import { FileTreeItem } from '../../types/FileTreeItem';
import { runCommand, runCommandDetached } from "../projectUtils";
import { randomUUID } from 'crypto';
import path from "path";
import { execSync } from 'child_process';
import { attachFileContents } from "../fileUtils/attachFileContents";
import fs from 'fs/promises';            // promise-based FS API
import fsSync from 'fs';                 // for existsSync in helper

/** Extract all file paths from a file tree recursively. */
function flattenPaths(tree: any[]): string[] {
  const out: string[] = [];
  for (const n of tree ?? []) {
    if (n?.path) out.push(n.path);
    if (Array.isArray(n?.children)) out.push(...flattenPaths(n.children));
  }
  return out;
}

/**
 * Recursively build a FileTreeItem from `webRoot`, always computing
 * paths **relative to that same root**, no matter how deep we recurse.
 */
async function dirToFileTree(current: string, webRoot: string): Promise<FileTreeItem> {
  const entries = await fs.readdir(current, { withFileTypes: true });

  const children: (FileTreeItem | undefined)[] = await Promise.all(
    entries.map(async entry => {
      const abs = path.join(current, entry.name);
      
      /* Skip heavyweight or build-generated directories.
         NOTE: keep .yarn/, but drop its cache sub-folder. */
      const SKIP_TOP = new Set([
        'node_modules', '.next', '.turbo',
        'out', 'dist', '.vercel', 'coverage',
        '.git', '.vscode', '.idea', '.DS_Store',
        '.pnpm-store'
      ]);
      if (SKIP_TOP.has(entry.name)) return undefined;
      if (
        entry.isDirectory() &&
        path.basename(current) === '.yarn' &&
        entry.name === 'cache'
      ) {
        return undefined;                    // skip .yarn/cache only
      }

      if (entry.isDirectory()) return dirToFileTree(abs, webRoot);   // recurse

      const code = await fs.readFile(abs, 'utf8');
      return {
        name: entry.name,
        path: `./web/${path.relative(webRoot, abs)}`,                // ← correct base
        type: 'file',
        code,
      };
    })
  );

  const relDir = path.relative(webRoot, current);
  return {
    name: path.basename(current),
    path: relDir ? `./web/${relDir}` : './web',                      // root dir path
    type: 'directory',
    children: children.filter(Boolean) as FileTreeItem[],            // drop undefined entries
  };
}

/**
 * Walk up from cwd until we find a sibling `web/` directory.
 * Guarantees we pass the *real* path, no matter where the server was launched.
 */
function findWebDir(): string {
  let dir = process.cwd();
  while (true) {
    const candidate = path.join(dir, 'web');
    if (fsSync.existsSync(candidate) && fsSync.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("Cannot locate top-level 'web' directory");
    }
    dir = parent;
  }
}

/** Block until every task-id is in a final state. */
async function waitForAll(taskIds: string[]): Promise<{
  succeeded: string[];
  failed: string[];
}> {
  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const id of taskIds) {
    if (!id) continue;
    try {
      const { task } = await pollTaskStatus(id);
      (task.status === 'succeed' || task.status === 'finished'
        ? succeeded
        : failed
      ).push(id);
    } catch (err) {
      console.error(`[GEN] pollTaskStatus error for ${id}:`, err);
      failed.push(id);
    }
  }
  return { succeeded, failed };
}

/** Helper to emit progress event when each file is written */
const emitFileWritten = (sendProgress: (data: unknown) => void): ((path: string, content: string) => void) => (path, content) => {
  sendProgress({
    event: 'file-written',
    path,
    content,
  });
};

interface Args {
  projectId: string;
  graph: Graph;
  workspace: WorkspaceHandle;
  sendProgress: (data: unknown) => void;
  userId: string;
}

export const handleGenerateCode = async ({
  projectId,
  graph,
  workspace,
  sendProgress,
  userId,
}: Args): Promise<{ sentinelId: string }> => {   
    console.log('[GEN] projectId   =', projectId);
    console.log('[GEN] userId      =', userId);
    console.log('[GEN] workspace   =', workspace);
    console.log('[GEN] nodes.len   =', graph.nodes.length);
    //console.log('[GEN] first node  =', graph.nodes[0]);
    
    try {
        // --------------------------------------------------------------------
        // All container-side UI work must happen in the SAME bind-mounted tree
        // that startProjectContainer exposes at /usr/src/<rootPath>/web.
        // --------------------------------------------------------------------
        const containerWebDir = `/usr/src/${workspace.rootPath}/web`;

        if (graph.nodes.length === 0) throw new Error('No nodes found');
        let functionCode = null;

        // ───────────────── collect code blocks ───────────────────────────
        const functionParts = graph.nodes
          .map(n => {
            const maybeCode =
              // new schema
              (n as any).config?.code ??
              // old/basic schema
              (n as any).data?.code ??
              null;

            return typeof maybeCode === 'string' ? maybeCode : null;
          })
          .filter(Boolean) as string[];

        console.log('[GEN] raw snippet count =', functionParts.length);
        if (functionParts.length) {
            //console.log('[GEN] first 200 chars of combined code:\n',
            //    functionParts.join('\n\n').slice(0, 200));
        }

        if (functionParts.length > 0) functionCode = functionParts.join('\n\n');
        else console.log('No valid function code found in nodes');

        console.log('DEBUG handleGenerateCode functionCode:', functionCode);
        
        sendProgress({ stage: 'file-tree', message: 'Refreshing file tree…' });
        const fileTreeTaskIds = await refreshWorkspaceTree(projectId, userId);
        console.log('[GEN] refreshWorkspaceTree triggered, taskIds =', fileTreeTaskIds);
        sendProgress({ stage: 'file-tree', message: 'Waiting for file-tree refresh…' });

        const { succeeded, failed } = await waitForAll(fileTreeTaskIds);

        console.log('[GEN] file-tree tasks done → ok:', succeeded, 'fail:', failed);
        sendProgress({
          stage: failed.length ? 'file-tree-failed' : 'file-tree-done',
          message: failed.length
            ? `File-tree refresh: ${failed.length} task(s) failed`
            : 'File-tree refresh complete'
        });

        if (failed.length) {
          throw new Error(`File-tree task(s) failed: ${failed.join(', ')}`);
        }

        // Get the file tree result to check for existing program directory
        const treeTaskId = fileTreeTaskIds[0];
        const treeResult = await pollTaskStatus(treeTaskId);
        const initialTree = JSON.parse(treeResult.task.result ?? '[]');
        
        // Gather existing paths so insertSrcFiles can decide create vs update
        const existingFilePaths = new Set<string>(flattenPaths(initialTree));
        
        // --- force-overwrite critical config files (handles "./" prefix) ----
        for (const f of ["web/package.json", "./web/package.json",
                         "web/tsconfig.json", "./web/tsconfig.json"]) {
          existingFilePaths.delete(f);
        }
        
        console.log("[GEN] after delete, has package.json?",
                    existingFilePaths.has("./web/package.json") ||
                    existingFilePaths.has("web/package.json"));

        /* ─────────────────────  A)  stream *existing* web/ directory  ───────────────────── */
        sendProgress({ stage: 'ui-gen', message: 'Streaming existing web/ files…' });

        const webRootDir = findWebDir();
        const creatorId   = userId;
        const uiTree      = await dirToFileTree(webRootDir, webRootDir);     // dynamic tree

        // Tell FE we're starting incremental UI push
        sendProgress({ stage: 'ui-stream', message: 'Streaming UI files…' });

        // ─── write UI files and WAIT until every task finishes ────────────────
        const uiWriteTaskIds = await insertSrcFiles(
          uiTree,
          projectId,
          existingFilePaths,
          creatorId,
          (path, code) => {
            sendProgress({ event: 'file-written', path, content: code });
            if (path.endsWith('tsconfig.json'))
              console.log('[GEN] wrote tsconfig', code.slice(0, 40));
          },
        );

        // block until every UI-write task is complete
        for (const id of uiWriteTaskIds) {
          await waitForTaskCompletion(id, 90, 2_000);
        }

        sendProgress({ event: 'ui-complete', message: 'UI streaming finished' });

        /* ──────────────────────  Install JS deps inside the container  ────────────────────── */

        const containerRootDir = `/usr/src/${workspace.rootPath}`;   // <── NEW

        /* ── One-time Yarn bootstrap inside the running container ── */
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc ` +
          "'corepack enable && " +
          // 1️⃣ place the Yarn v1 binary exactly where Next.js expects it
          "corepack prepare yarn@1.22.22 --activate " +
          "--install-to ${containerRootDir}/web/.yarn/releases/yarn-1.22.22.cjs && " +
          // 2️⃣ make sure project-local rc does not override PnP/etc.
          "rm -f ${containerRootDir}/web/.yarnrc'",
          '.',
          projectId,
        );

        {
          // STEP 0  ➜ regenerate yarn.lock so the upcoming frozen install never bails
          sendProgress({ stage: 'deps', message: 'Creating/refreshing yarn.lock in container…' });

          const lockfileCmd = [
            'docker exec',
            // isolate Yarn's cache just like the main install
            '-e', 'YARN_CACHE_FOLDER=/tmp/yarn-cache',
            '-w', containerRootDir,                              // run from repo root
            workspace.containerName,
            'bash -lc "rm -rf \\$YARN_CACHE_FOLDER && mkdir -p \\$YARN_CACHE_FOLDER && ' +
              'yarn --cwd web install --lockfile-only --network-timeout 600000"' // ⬅ --cwd web
          ].join(' ');

          await runCommand(lockfileCmd, '.', projectId);

          sendProgress({ stage: 'deps', message: 'yarn.lock updated; installing deps…' });

          // second pass – real install but tolerant to the fresh lock-file
          const installCmd = [
            'docker exec',
            // isolate Yarn's cache so every dApp build starts clean
            '-e', 'YARN_CACHE_FOLDER=/tmp/yarn-cache',
            '-w', containerRootDir,
            workspace.containerName,
            'bash -lc "mkdir -p \\$YARN_CACHE_FOLDER && ' +
              'yarn --cwd web install --prefer-offline --network-timeout 600000"'
          ].join(' ');

          await runCommand(installCmd, '.', projectId);
          sendProgress({ stage: 'deps', message: 'JS dependencies installed' });
        }

        // ─── Restart Next.js dev server so it picks up next-themes, toast, etc.
        sendProgress({ stage: 'deps', message: 'Restarting Next.js server…' });

        /* 1) stop any previous dev instance — ignore "not found" exit */
        await runCommand(
          `docker exec ${workspace.containerName} pkill -f 'next dev' || true`,
          '.',
          projectId,
        );

        /* 2) start a fresh dev server, detach + pipe logs */
        runCommandDetached(
          `docker exec -d ` +
          `-e APP_BASE_PATH=/dapp/$APP_ID ` +
          `-w /usr/src/${workspace.rootPath}/web ` +
          `${workspace.containerName} bash -lc 'yarn dev 2>&1'`,
          '.',
          `next-dev-${projectId}`,
        ).catch(console.error);

        sendProgress({ stage: 'deps', message: 'Dev server restarted' });

        /* ──────────────────────────────────────────────────────────────────────── */

        /* In dev-server mode the container is already running `yarn dev`,
           so a full `next build` is both slow and unnecessary. Skip it. */
        if (!process.env.SF_DEV_SERVER) {
          sendProgress({
            stage: 'next-build',
            message: 'Running Next.js build to process Tailwind CSS…'
          });
          try {
            // Force-write the tsconfig.json file to ensure it has the correct configuration
            await runCommand(
              `docker exec ${workspace.containerName} bash -lc 'cat > ${containerWebDir}/tsconfig.json <<EOF
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "node",
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": "src",
    "paths": { "@/*": ["*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF'`,
              '.', 
              projectId
            );
            
            await runCommand(
              // force standalone output _inside_ the running container
              `docker exec \
    -e NEXT_PRIVATE_STANDALONE=true \
    -e APP_BASE_PATH=/dapp/$APP_ID \
    -w ${containerWebDir} \
    ${workspace.containerName} npm run build`,
              '.',
              projectId
            );
            sendProgress({
              stage: 'next-build-done',
              message: 'Next.js build completed'
            });
          } catch (error) {
            console.error('Error during Next.js build:', error);
            sendProgress({
              stage: 'next-build-failed',
              message: 'Next.js build failed'
            });
          }
        }

        /* runtime server already started by docker run → nothing to do */

        // ───────────────────────── write graph-derived Rust sources ──────────────
        // For now, assume a basic program structure exists or will be created
        // TODO: implement findProgramsDirectory and initAnchorProject when available
        const programName = 'my_program'; // TODO: derive from project context
        const programId = '11111111111111111111111111111111'; // TODO: fetch real ID
        
        // Call ensure config helpers BEFORE refreshing the tree
        await ensureAnchorTomlProgram(
          workspace,
          programName,
          programId,
          projectId,
          /* creatorId */ null
        );

        await ensureRootWorkspaceMembers(
          workspace,
          projectId,
          /* creatorId */ null
        );

        // Build in-memory src/ tree
        const projectState = { nodes: graph.nodes, edges: graph.edges || [] };
        const srcTree = genSrcFiles(projectState, programName, programId);
        if (!srcTree) throw new Error('genSrcFiles returned null');
        
        // Parse details again to get canonical instruction names for debug logging
        const { instructions: canonicalInstructions, state: canonicalState } = parseNodeDetails(projectState);
        // The canonicalization of inst.name based on fnMatch happens *inside* genSrcFiles
        // and also inside parseNodeDetails if we were to enhance it.
        // For now, assume parseNodeDetails provides the names needed for paths,
        // and genSrcFiles internally uses the fnMatch for generation.
        // To be perfectly correct, we might need genSrcFiles to return canonicalInstructions
        // or re-run the fnMatch logic here. For debugPrintFiles, this should be sufficient.

        /* --------------------------------------------------------------- *
         * write the src tree into the workspace
         * --------------------------------------------------------------- */
        sendProgress({ stage: 'src-gen', message: 'Generating Rust sources…' });
        console.log('[GEN] Generated src tree:', JSON.stringify(srcTree, null, 2));
        
        function writeFilesAndEmitTree(
          rootNode: FileTreeItem,
          projectId: string,
          existing: Set<string>,
          creatorId: string | null,
          workspace: WorkspaceHandle,
          sendProgress: (d: unknown) => void,
        ): Promise<string> {
          return (async () => {
            const writeTaskIds = await insertSrcFiles(rootNode, projectId, existingFilePaths, creatorId, emitFileWritten(sendProgress));
            
            // 🟢 NEW – wait until every write-file task finishes
            for (const tId of writeTaskIds) {
              await waitForTaskCompletion(tId, 90, 2_000);
            }

            const rootBase = process.env.ROOT_FOLDER!;
            const absRoot  = path.join(rootBase, workspace.rootPath);
            const tinyTree = [rootNode];
            await attachFileContents(tinyTree, absRoot, workspace.containerName);

            // now it is safe to raise the sentinel
            const sentinelId = await markWriteDone(projectId);
            console.log('[GEN] write-done sentinel:', sentinelId);
            return sentinelId;
          })();
        }
        
        const sentinelId = await writeFilesAndEmitTree(
          srcTree,
          projectId,
          existingFilePaths,
          /* creatorId */ null,
          workspace,
          sendProgress,
        );

        sendProgress({ stage: "src-gen-done", message: "Rust sources ready" });
        sendProgress({ stage: "ui-complete" });


        // ─────────── Run static lint on Cargo manifests before amending ───────────
        console.log('[GEN] Running static Cargo.toml linter...');
        lintWorkspaceManifests({ projectId, userId, workspace })
          .then(() =>
            sendProgress({ stage: "lint-done", message: "Cargo manifests validated" }),
          )
          .catch(err =>
            sendProgress({ stage: "lint-failed", message: `Manifest validation failed: ${String(err)}` }),
          );

        // same pattern for amendConfigFiles — *do not await*
        amendConfigFiles(projectId, userId)
          .then(({ anchorTaskId }) =>
            sendProgress({ stage: "amend-done", anchorTaskId, message: "[handleGenerateCode] Amend done" }),
          )
          .catch(err =>
            sendProgress({ stage: "amend-failed", message: String(err) }),
          );

        // ─────────── Debug: dump container tree ───────────
        const dumpTaskId = await createTask(
            'Dump Container Tree', null, projectId);
        try {
          await debugDumpContainerTree(
            workspace.containerName,
            workspace.rootPath,
            dumpTaskId,
          );
        } finally {
          // --- Print key files (always run) ---
          try {
            const important = [
              "Anchor.toml",
              "Cargo.toml",
              // generated program files
              `programs/${programName}/src/lib.rs`,
              `programs/${programName}/src/instructions/mod.rs`,
              ...canonicalInstructions.map(i => `programs/${programName}/src/instructions/${i.name}.rs`),
            ];
            // Add state.rs to important files if state exists
            if (canonicalState.length > 0) {
              important.push(`programs/${programName}/src/state.rs`);
            }

            await debugPrintFiles(
              workspace.containerName,
              workspace.rootPath,
              important,
              dumpTaskId,
            );
          } catch (e) {
            console.warn("[DEBUG] failed to print file contents:", e);
          }
          await updateTaskStatus(dumpTaskId, 'succeed', 'Tree dumped and files printed');
        }
        
        // ─── end of function ────────────────────────────────
        return { sentinelId };            // ← NEW
    } catch (err) {
        console.error('Error in handleGenerateCode:', err);
        throw err;
    }
};