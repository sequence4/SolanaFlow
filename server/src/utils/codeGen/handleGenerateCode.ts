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
import { APP_CONFIG } from '../../config/appConfig';
import { Keypair } from '@solana/web3.js';
import pool from '../../config/database';
import { normalizeProjectName } from '../stringUtils';
import { saveProgramSecret, awsSecretsEnabled } from '../awsSecrets';
import { sendCodeGenProgress } from '../progressUtils';

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
const emitFileWritten = (sendProgress: (data: unknown) => void): ((path: string, content: string) => Promise<void>) => async (path, content) => {
  // Include content for frontend but avoid logging it to console
  sendProgress({
    event: 'file-written',
    path,
    content, // Include actual content for frontend
  });

  // Send progress update with code snippet for key files during generation
  const filename = path.split('/').pop() || '';
  const isKeyFile = filename === 'lib.rs' || filename === 'mod.rs' || filename.endsWith('.rs') ||
                    filename.endsWith('.ts') || filename.endsWith('.tsx') ||
                    filename.endsWith('.js') || filename.endsWith('.jsx');
  
  if (isKeyFile && content.trim() && content.length > 20) {
    // Determine language based on file extension
    const language = filename.endsWith('.rs') ? 'rust' : 
                     filename.endsWith('.ts') || filename.endsWith('.tsx') ? 'typescript' :
                     filename.endsWith('.js') || filename.endsWith('.jsx') ? 'javascript' :
                     'text';
    
    // Calculate progressive percentage based on file type and order - START FROM 0
    let progressPct = 10; // default  
    if (filename === 'lib.rs') progressPct = 5;
    else if (filename === 'mod.rs') progressPct = 15;
    else if (filename.includes('instruction')) progressPct = 35;
    else if (filename.includes('account')) progressPct = 55;
    else if (filename.includes('state')) progressPct = 75;
    else if (filename.includes('error')) progressPct = 90;
    else progressPct = Math.min(80, Math.random() * 30 + 20);
    
    // Count lines for display
    const lineCount = content.split('\n').length;
    
    sendProgress({
      stage: 'code-gen',
      status: 'active',
      message: `Generating ${filename}... (${lineCount} lines)`,
      pct: progressPct,
      codeSnippet: {
        language,
        content: content.length > 1000 ? content.substring(0, 1000) + '\n\n// ... (truncated for display)' : content,
        filename,
        lineCount
      }
    });
    
    // Small delay to make file generation feel more sequential
    await new Promise(resolve => setTimeout(resolve, 100));
  }
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
}: Args): Promise<{ sentinelId: string; programName: string }> => {   
    /* Dev-mode flag set by dev.sh or CI: container already runs `next dev` */
    const isDevServer = process.env.SF_DEV_SERVER === '1';

    console.log('[GEN] Starting code generation for project:', projectId);
    
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

        console.log(`[GEN] Processing ${functionParts.length} code snippets from graph nodes`);

        if (functionParts.length > 0) functionCode = functionParts.join('\n\n');
        else console.log('[GEN] No valid function code found in nodes');
        
        sendProgress({ stage: 'file-tree', message: 'Refreshing file tree…' });
        const fileTreeTaskIds = await refreshWorkspaceTree(projectId, userId);
        console.log('[GEN] File tree refresh initiated');
        sendProgress({ stage: 'file-tree', message: 'Waiting for file-tree refresh…' });

        const { succeeded, failed } = await waitForAll(fileTreeTaskIds);

        console.log(`[GEN] File tree tasks completed: ${succeeded.length} succeeded, ${failed.length} failed`);
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
        for (const f of [
          "web/package.json",               "./web/package.json",
          "web/tsconfig.json",              "./web/tsconfig.json",
          // always refresh Tailwind + toast hooks so local fixes reach the container
          "web/tailwind.config.js",         "./web/tailwind.config.js",
          "web/src/components/ui/use-toast.ts",
          "./web/src/components/ui/use-toast.ts",
          "web/src/components/ui/toaster.tsx",
          "./web/src/components/ui/toaster.tsx",
        ]) {
          existingFilePaths.delete(f);
        }

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
          async (path, code) => {
            sendProgress({ 
              event: 'file-written', 
              path,
              content: code, // Include actual content for frontend
            });
            if (path.endsWith('tsconfig.json'))
              console.log('[GEN] Wrote tsconfig.json file');
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
          // run *inside* the container -- single-quoted so the whole command is
          // evaluated by bash there, and `${containerRootDir}` expands correctly
          `docker exec ${workspace.containerName} bash -lc 'rm -f ${containerRootDir}/web/.yarnrc'`,
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

          /* shadcn-ui CLI init REMOVED
             Reason: `npx shadcn-ui init` overwrites tailwind.config.js and
             globals.css every run, re-introducing the
             `tailwindcss-shadcn-ui/preset` import that crashes Tailwind
             (see GitHub issues #878, #2030, #1086). The preset is already
             provided via package.json, so nothing else is required. */

          sendProgress({ stage: 'deps', message: 'JS dependencies installed' });
        }

        // ─── Restart Next.js dev server so it picks up next-themes, toast, etc.
        sendProgress({ stage: 'deps', message: 'Restarting Next.js server…' });

        /* 1️⃣  Kill ONLY the stand-alone server; keep `next dev` alive.      */
        await runCommand(
          `docker exec ${workspace.containerName} pkill -f '.next/standalone/server.js' || true`,
          '.',
          projectId,
        );

        /* 2️⃣  If we are *not* in dev mode, container CMD will start server.js
                once the build finishes.  When in dev mode no restart needed. */
        sendProgress({
          stage: 'deps',
          message: isDevServer
            ? 'Dev server detected – no restart needed'
            : 'Dev server will start via CMD'
        });

        /* ──────────────────────────────────────────────────────────────────────── */

        /* ────────────────── 3️⃣  Build *only* in standalone mode ──────────── */
        if (!isDevServer) {
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
        } // ← closes "if (!isDevServer)"
        /* ── dev-mode skip: build/restart not required ── */

        /* runtime server already started by docker run → nothing to do */

        // ───────────────────────── write graph-derived Rust sources ──────────────
        // Derive program name from project context (fallback to 'my_program' if not found)
        /* -----------------------------------------------------------
         * Derive the **crate name** from the workspace's root folder:
         *   untitled-project-<uid>  →  untitled_project
         * This keeps the name identical to programs/<crate>/ and
         * prevents "<name> is not part of the workspace" errors.
         * ----------------------------------------------------------- */
        const rootStem   = workspace.rootPath.replace(/-[a-f0-9]{8}$/, '');
        let programName  = rootStem.replace(/-/g, '_');       // ⇒ snake_case
        if (/^[0-9]/.test(programName)) programName = 'p' + programName;
        try {
          const nameRes = await pool.query('SELECT name FROM solanaproject WHERE id = $1', [projectId]);
          const projName: string | undefined = nameRes.rows[0]?.name;
          if (projName) {
            programName = normalizeProjectName(projName);
          }

          // 🔧 Anchor treats every crate as *snake_case*; a dash here makes
          // it regenerate a fresh keypair and triggers DeclaredProgramIdMismatch.
          programName = programName.replace(/-/g, '_');
        } catch (e) {
          console.warn('Could not fetch project name, using default:', e);
        }
        // Generate a fresh, random keypair so every dApp has a unique program ID
        const programKeypair = Keypair.generate();
        const programId = programKeypair.publicKey.toBase58();

        // Persist the secret key in AWS Secrets Manager for secure storage
        if (awsSecretsEnabled()) {
          await saveProgramSecret(programId, programKeypair.secretKey);
        } else {
          console.warn('[GEN] AWS secrets disabled – keypair kept only on disk');
        }

        // Save the keypair to a file for later use (e.g. Anchor deploy or upgrades)
        const walletPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${programId}.json`);
        fsSync.writeFileSync(walletPath, JSON.stringify(Array.from(programKeypair.secretKey)));

        /** -----------------------------------------------------------------
         * Ensure the keypair exists inside the container *before* we call any
         * `anchor keys sync` commands.  This prevents missing‑file errors for
         * crates whose kebab/snake stems differ from `programName`.
         * ----------------------------------------------------------------- */
        const initialKeyJson = JSON.stringify(Array.from(programKeypair.secretKey));
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'mkdir -p /usr/src/target/deploy && echo ${initialKeyJson.replace(/'/g, "'\\''")} > /usr/src/target/deploy/${programName}-keypair.json'`,
          '.',
          randomUUID(),
          { skipSuccessUpdate: true },
        );

        /* ────────────────────────────────────────────────────────────────
         * NEW ✨  Keep every Anchor source‑of‑truth in sync *before* build
         * ────────────────────────────────────────────────────────────────
         * 1.  Ensure the keypair file stem exactly matches the crate name
         *     (Anchor looks for target/deploy/<crate>-keypair.json).
         * 2.  Run `anchor keys sync` to copy that pubkey into
         *        • programs/<crate>/src/lib.rs   (declare_id!)
         *        • Anchor.toml [programs.devnet] (and other clusters)
         *     so the subsequent `anchor build` bakes the correct ID.
         */
        const crateSnake = programName.replace(/-/g, "_");      // Anchor crate dirs are snake_case
        const crateKebab = programName.replace(/_/g, "-");      // Anchor crate dirs are kebab-case
        /**
         * Copy the deterministic keypair under **both** possible stems so that
         * `anchor keys sync` finds whichever variant it expects.
         *
         * ⚠️  When `crateStem === programName` the two filenames are identical, and
         * `cp` aborts with "are the same file".  Wrap the second copy in a guard to
         * make the command idempotent.
         */
        const copyKeypairCmd =
          programName === crateSnake
            ? "true"       // nothing to do – stems already match
            : `cp -f /usr/src/target/deploy/${programName}-keypair.json /usr/src/target/deploy/${crateSnake}-keypair.json`;

        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'mkdir -p /usr/src/target/deploy && ${copyKeypairCmd}'`,
          ".",
          randomUUID(),
          { skipSuccessUpdate: true }
        );
        
        // Also copy for kebab-case variant if it differs from the program name
        const copyKebabKeypairCmd =
          programName === crateKebab
            ? "true"       // nothing to do – stems already match
            : `cp -f /usr/src/target/deploy/${programName}-keypair.json /usr/src/target/deploy/${crateKebab}-keypair.json`;
            
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'mkdir -p /usr/src/target/deploy && ${copyKebabKeypairCmd}'`,
          ".",
          randomUUID(),
          { skipSuccessUpdate: true }
        );

        // ⚠️  Must be executed from the workspace root *inside* the container.
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'cd /usr/src/${workspace.rootPath} && anchor keys sync'`,
          ".",
          randomUUID(),
          { skipSuccessUpdate: true }
        );

        // Self-verify the keypair generation
        const derivedPubkey = Keypair.fromSecretKey(programKeypair.secretKey).publicKey.toBase58();
        if (derivedPubkey !== programId) {
          throw new Error('Keypair self-verification failed');
        }
        console.log('[GEN] Generated program ID:', programId);

        /* ──────────────────────────────────────────────────────────────
         * Persist programId inside solanaproject.details.projectState
         * so the FE can read it before the first deploy attempt.
         * ────────────────────────────────────────────────────────────── */
        try {
          await pool.query(
            `
            UPDATE solanaproject
            SET    details =
                   jsonb_set(
                     COALESCE(details, '{}'::jsonb),
                     '{projectState,programId}',
                     to_jsonb($1::text),
                     true
                   )
            WHERE  id = $2
            `,
            [programId, projectId],
          );

          /* ─────────────────────────────────────────────────────────────
           * NEW: also save the deterministic ID under details.lastProgramId
           * so startAnchorBuildTask can locate the correct key‑pair.
           * ──────────────────────────────────────────────────────────── */
          await pool.query(
            "UPDATE solanaproject \
               SET details = COALESCE(details, '{}'::jsonb) \
                            || $1::jsonb \
             WHERE id = $2",
            [JSON.stringify({ lastProgramId: programId }), projectId],
          );
 
          console.log('[GEN] Program ID saved to database');
          
          // Notify frontend that the programId is now available
          sendProgress({ stage: 'programIdPersisted', programId });
        } catch (e) {
          console.error('[GEN] Failed to persist program ID to DB:', e);
        }
        
        /**
         * Write the key-pair **directly to the global warm-cache**
         * (/usr/src/target/deploy) so the file survives the later
         *   rm -rf target/deploy && ln -sfnT /usr/src/target/deploy target/deploy
         * step.  This guarantees Anchor re-uses the same key-pair it sees
         * during code-gen, eliminating the phantom "second" Program ID.
         */
        const keypairJson = JSON.stringify(Array.from(programKeypair.secretKey));
        const snakeKeyFile = `${crateSnake}-keypair.json`;
        const kebabKeyFile = `${crateKebab}-keypair.json`;
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'mkdir -p /usr/src/target/deploy && ` +
          // tee writes the same bytes to both stems in a single pass
          `echo ${JSON.stringify(keypairJson)} | tee /usr/src/target/deploy/${snakeKeyFile} > /usr/src/target/deploy/${kebabKeyFile}'`,
          ".",
          randomUUID(),
          { skipSuccessUpdate: true }
        );

        /*───────────────────────────────────────────────────────────────
         * 🧹  **NEW:** Immediately remove any leftover *template* keys so
         *      Anchor can never confuse them with the real program.
         *      – `anchor_template‑keypair.json`
         *      – `my_program‑keypair.json`   (old boiler‑plate crate)
         *───────────────────────────────────────────────────────────────*/
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc ` +
          `'find /usr/src/target/deploy -maxdepth 1 -type f \\( ` +
            `-name "anchor_template-*-keypair.json" -o ` +
            `-name "my_program-*-keypair.json"    -o ` +
            `-name "my-program-*-keypair.json" \\) -delete'`,
          "." /* cwd (unused) */,
          randomUUID(),
          { skipSuccessUpdate: true },
        );
        
        // Inform client about the program ID for early access
        sendProgress({ stage: 'ephemeralKey', pubkey: programId });
        // Include the env var so local dev server can pick it up instantly
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'echo NEXT_PUBLIC_PROGRAM_ID=${programId} >> /usr/src/${workspace.rootPath}/web/.env'`,
          '.',
          `inject-env-${Date.now()}`,
          { skipSuccessUpdate: true },
        );
        
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
        // Collect all Rust files from the generated tree
        const collectRustFiles = (tree: FileTreeItem): Array<{filename: string, content: string, path: string}> => {
          const rustFiles: Array<{filename: string, content: string, path: string}> = [];
          
          const traverse = (node: FileTreeItem, currentPath: string = '') => {
            const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
            
            if (node.type === 'file' && node.name.endsWith('.rs')) {
              rustFiles.push({
                filename: node.name,
                content: node.code || '',
                path: fullPath
              });
            }
            if (node.children) {
              for (const child of node.children) {
                traverse(child, fullPath);
              }
            }
          };
          
          traverse(tree);
          return rustFiles;
        };

        // Collect all Rust files from the source tree
        const allRustFiles = collectRustFiles(srcTree);
        
        // Filter to only important on-chain files and sort them by importance
        const importantFiles = allRustFiles.filter(f => 
          f.filename === 'lib.rs' ||
          f.filename === 'state.rs' ||
          f.filename === 'error.rs' ||
          f.path.includes('/instructions/') ||
          f.filename === 'mod.rs'
        ).sort((a, b) => {
          // Order: lib.rs first, then state.rs, then instructions, then others
          if (a.filename === 'lib.rs') return -1;
          if (b.filename === 'lib.rs') return 1;
          if (a.filename === 'state.rs') return -1;
          if (b.filename === 'state.rs') return 1;
          if (a.path.includes('/instructions/') && !b.path.includes('/instructions/')) return -1;
          if (b.path.includes('/instructions/') && !a.path.includes('/instructions/')) return 1;
          return a.filename.localeCompare(b.filename);
        });

        // Send initial progress with file information for sequential display
        sendProgress({
          stage: 'code-gen',
          status: 'active',
          message: 'Generating Solana program files...',
          pct: 0,
          files: importantFiles.map(f => ({
            filename: f.path,
            content: f.content.substring(0, 500) + (f.content.length > 500 ? '\n\n// ... (truncated for display)' : ''),
            language: 'rust',
            fullContent: f.content
          })),
          type: 'sequential-code'
        });

        // Start smooth code generation progress  
        const codeGenPromise = sendCodeGenProgress(sendProgress, importantFiles.length);
        console.log(`[GEN] Generating ${importantFiles.length} Rust source files`);
        
        function writeFilesAndEmitTree(
          rootNode: FileTreeItem,
          projectId: string,
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
            // Include real content for frontend but skip logging to console
            const skipContentLogging = true;
            await attachFileContents(tinyTree, absRoot, workspace.containerName, false, skipContentLogging);

            // now it is safe to raise the sentinel
            const sentinelId = await markWriteDone(projectId);
            console.log('[GEN] Write operations completed, sentinel ID:', sentinelId);
            return sentinelId;
          })();
        }
        
        const sentinelId = await writeFilesAndEmitTree(
          srcTree,
          projectId,
          /* creatorId */ null,
          workspace,
          sendProgress,
        );

        // Wait for code generation progress to complete
        await codeGenPromise;
        sendProgress({ 
          stage: 'code-gen', 
          status: 'completed',
          message: 'Code generation complete!',
          pct: 100
        });
        sendProgress({ stage: "ui-complete" });


        // ─────────── Run static lint on Cargo manifests before amending ───────────
        console.log('[GEN] Running Cargo.toml linter');
        lintWorkspaceManifests({ projectId, userId, workspace })
          .then(() =>
            sendProgress({ stage: "lint-done", message: "Cargo manifests validated" }),
          )
          .catch(err =>
            sendProgress({ stage: "lint-failed", message: `Manifest validation failed: ${String(err)}` }),
          );

        // Amend config files **first** so IDL changes are in place for the build.
        const { anchorTaskId } = await amendConfigFiles(projectId, userId);
        sendProgress({
          stage: "amend-done",
          anchorTaskId,
          message: "[handleGenerateCode] Amend done",
        });

        /* --------------------------------------------------------------
         * ensureAnchorTomlProgram / amendConfigFiles may have just
         * touched Anchor.toml – run a second keys sync so
         * Anchor.toml, declare_id!(), and the JSON keypair stay equal
         * -------------------------------------------------------------- */
        /* --------------------------------------------------------------
         * Re‑sync keys, purge old artefacts, then force a *clean* build.
         * `cargo-build-sbf` (called by `anchor build`) does **not**
         * understand "--force" → use `anchor clean` instead.
         * -------------------------------------------------------------- */
        /* --------------------------------------------------------------
         * Final, deterministic rebuild sequence:
         *   1. anchor clean            – remove all artefacts **and** keypairs
         *   2. restore keypair JSON    – copy deterministic pair back
         *   3. anchor keys sync        – update Anchor.toml + declare_id!
         *   4. anchor build            – produce fresh .so that embeds our ID
         * -------------------------------------------------------------- */
        const WORKDIR   = `/usr/src/${workspace.rootPath}`;
        const KEYS_DIR  = `target/deploy`;
        const snakeKey  = `${crateSnake}-keypair.json`;  // anchor_template-keypair.json
        const kebabKey  = `${crateKebab}-keypair.json`;  // anchor-template-keypair.json

        // escape once for safe bash literal
        const keyJsonEsc = keypairJson.replace(/'/g, `'\\''`);

        const script = [
          `cd ${WORKDIR}`,
          'anchor clean',
          `mkdir -p ${KEYS_DIR}`,
          // always restore under **both** stems so Anchor never regenerates
          `echo '${keyJsonEsc}' | tee ${KEYS_DIR}/${snakeKey} > ${KEYS_DIR}/${kebabKey}`,
          `anchor keys sync`,
          // Build normally; cargo‑build‑sbf only *compiles* test targets,
          // it doesn't execute them, so no extra flag is required.
          `anchor build -p ${programName}`
        ].join(' && ');

        await runCommand(
          `docker exec ${workspace.containerName} bash -lc "${script}"`,
          '.',
          randomUUID(),
          { skipSuccessUpdate: true }
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
        return { sentinelId, programName };
    } catch (err) {
        console.error('Error in handleGenerateCode:', err);
        throw err;
    }
};