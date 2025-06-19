import { refreshWorkspaceTree } from './refreshWorkspaceTree';
import { genUi } from './genUi';
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
import { attachFileContents } from "../fileUtils/attachFileContents";
import {
  HOME_PAGE_TSX,
  ROOT_LAYOUT_TSX,
  MINT_FORM_TSX,
  TOKEN_CREATED_SUCCESS_TSX,
  WALLET_TSX,
  THEME_TOGGLE_TSX,
  UI_BUTTON_TSX,
  UI_INPUT_TSX,
  UI_LABEL_TSX,
  UTILS_TS,
  GLOBALS_CSS,
  TAILWIND_CONFIG,
  POSTCSS_CONFIG,
  WALLET_CONNECTION_PROVIDER_TSX
} from './uiTemplates';

/** Extract all file paths from a file tree recursively. */
function flattenPaths(tree: any[]): string[] {
  const out: string[] = [];
  for (const n of tree ?? []) {
    if (n?.path) out.push(n.path);
    if (Array.isArray(n?.children)) out.push(...flattenPaths(n.children));
  }
  return out;
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

/** Write the token-minting UI tree, wait for all tasks, attach contents, and
 *  send a progress event.  MUST be called *before* Rust generation so the
 *  user sees the preview immediately.
 */
async function writeUiFirst(
  uiRoot   : FileTreeItem,
  projectId: string,
  existing : Set<string>,
  workspace: WorkspaceHandle,
  sendProgress: (d: unknown) => void,
) {
  // 1) schedule writes
  const uiTaskIds = await insertSrcFiles(uiRoot, projectId, existing, null, emitFileWritten(sendProgress));

  // 2) let the caller know we're starting UI writes
  sendProgress({ stage: 'ui-write', message: 'Writing UI files…' });

  // 3) wait for every task to finish (same timeouts you use elsewhere)
  for (const tId of uiTaskIds) {
    await waitForTaskCompletion(tId, 90, 2_000);
  }

  // 4) attach the written contents for the file-tree panel
  const absRoot  = path.join(process.env.ROOT_FOLDER!, workspace.rootPath);
  await attachFileContents([uiRoot], absRoot, workspace.containerName);

  // 5) tell the FE the preview is ready
  sendProgress({
    stage: 'ui-ready',
    message: 'UI code written – preview available',
    fileTree: [uiRoot],
  });
}

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

        //const frontendTaskId = await genUi(nodes);   // possible skip this step if not working correctly (save til end) 
        
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

        /* ─────────────────────  A)  generate and write the UI FIRST  ───────────────────── */
        sendProgress({ stage: 'ui-gen', message: 'Generating token-minting UI…' });
        
        // For streaming, use the userId as creatorId
        const creatorId = userId;
        
        // Build the UI file tree
        const uiTree = {
          name: ".",
          path: "./web",
          type: "directory" as const,
          children: [
            {
              name: "app",
              path: "./web/app",
              type: "directory" as const,
              children: [
                { name: "page.tsx", path: "./web/app/page.tsx", type: "file" as const, code: HOME_PAGE_TSX },
                { name: "layout.tsx", path: "./web/app/layout.tsx", type: "file" as const, code: ROOT_LAYOUT_TSX },
                { name: "globals.css", path: "./web/app/globals.css", type: "file" as const, code: GLOBALS_CSS }
              ]
            },
            {
              name: "src",
              path: "./web/src",
              type: "directory" as const,
              children: [
                {
                  name: "components",
                  path: "./web/src/components",
                  type: "directory" as const,
                  children: [
                    { name: "mint-form.tsx", path: "./web/src/components/mint-form.tsx", type: "file" as const, code: MINT_FORM_TSX },
                    { name: "token-created-success.tsx", path: "./web/src/components/token-created-success.tsx", type: "file" as const, code: TOKEN_CREATED_SUCCESS_TSX },
                    { name: "theme-toggle.tsx", path: "./web/src/components/theme-toggle.tsx", type: "file" as const, code: THEME_TOGGLE_TSX },
                    { name: "wallet.tsx", path: "./web/src/components/wallet.tsx", type: "file" as const, code: WALLET_TSX },
                    {
                      name: "ui",
                      path: "./web/src/components/ui",
                      type: "directory" as const,
                      children: [
                        { name: "button.tsx", path: "./web/src/components/ui/button.tsx", type: "file" as const, code: UI_BUTTON_TSX },
                        { name: "input.tsx", path: "./web/src/components/ui/input.tsx", type: "file" as const, code: UI_INPUT_TSX },
                        { name: "label.tsx", path: "./web/src/components/ui/label.tsx", type: "file" as const, code: UI_LABEL_TSX }
                      ]
                    }
                  ]
                },
                {
                  name: "context",
                  path: "./web/src/context",
                  type: "directory" as const,
                  children: [
                    { name: "WalletConnectionProvider.tsx", path: "./web/src/context/WalletConnectionProvider.tsx", type: "file" as const, code: WALLET_CONNECTION_PROVIDER_TSX }
                  ]
                },
                {
                  name: "lib",
                  path: "./web/src/lib",
                  type: "directory" as const,
                  children: [
                    { name: "utils.ts", path: "./web/src/lib/utils.ts", type: "file" as const, code: UTILS_TS }
                  ]
                }
              ]
            },
            { name: "tailwind.config.js", path: "./web/tailwind.config.js", type: "file" as const, code: TAILWIND_CONFIG },
            { name: "postcss.config.js", path: "./web/postcss.config.js", type: "file" as const, code: POSTCSS_CONFIG },
            {
              name: "idl",
              path: "./web/idl",
              type: "directory" as const,
              children: [
                { name: "solanaflow_token.json", path: "./web/idl/solanaflow_token.json", type: "file" as const, code: "{}" }
              ]
            }
          ]
        } as FileTreeItem;

        // Tell FE we're starting incremental UI push
        sendProgress({ stage: 'ui-stream', message: 'Streaming UI files…' });

        await insertSrcFiles(
          uiTree,
          projectId,
          existingFilePaths,
          creatorId,
          (path, code) => sendProgress({ event: 'file-written', path, content: code }),
        );

        // All UI files done
        sendProgress({ event: 'ui-complete', message: 'UI streaming finished' });

        // Run Next.js build to ensure Tailwind processes all the new files
        sendProgress({ stage: 'next-build', message: 'Running Next.js build to process Tailwind CSS...' });
        try {
          await runCommand(
            // force standalone output _inside_ the running container
            `docker exec -e NEXT_PRIVATE_STANDALONE=true -w /usr/share/solanaflow/web ` +
            `${workspace.containerName} npm run build`,
            '.',
            projectId
          );
          sendProgress({ stage: 'next-build-done', message: 'Next.js build completed' });
        } catch (error) {
          console.error('Error during Next.js build:', error);
          sendProgress({ stage: 'next-build-failed', message: 'Next.js build failed' });
        }

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
        // no extra progress needed here – ui-ready already fired
        sendProgress({ stage: "src-gen-done", message: "Rust sources ready" });

        // ++++++++++++++++ ② NEW – generate dApp UI ++++++++++++++++
        const dAppUiTree = genUi("SolanaFlow Token")[0];  // Get the first item from the array
        await insertSrcFiles(
          dAppUiTree,
          projectId,
          existingFilePaths,
          creatorId,
          // stream every written file immediately
          (path, content) => sendProgress({ event: "file-written", path, content })
        );
        // tell frontend UI files are done
        sendProgress({ stage: "ui-complete" });

        // 🟢 start the server **inside the container** so cwd is valid
        runCommandDetached(
          `docker exec -w /usr/share/solanaflow/web ` +
          `${workspace.containerName} bash -lc '` +
          `node .next/standalone/server.js'`,
          '.',                              // host cwd irrelevant
          `next-serve-${projectId}`         // no extra options needed
        ).catch(console.error);
        // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

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