import { refreshWorkspaceTree } from './refreshWorkspaceTree';
//import { genUi } from './genUi';
import { Graph } from '../../types/graph';
import type { WorkspaceHandle } from '../deploy/prepEnv';
import { amendConfigFiles } from './amendConfigFiles';
import { pollTaskStatus, createTask, updateTaskStatus } from '../taskUtils';
import { genSrcFiles } from './genSrcFiles';
import { insertSrcFiles } from './insertSrcFiles';
import { debugDumpContainerTree, debugPrintFiles } from '../containerUtils';
import { ensureAnchorTomlProgram, ensureRootWorkspaceMembers } from './ensureConfigHelpers';
import { parseNodeDetails } from './parseNodeDetails';
import { lintWorkspaceManifests } from './cargoManifestLint';
import { FileTreeItem } from '../../types/FileTreeItem';
import { runCommand } from "../projectUtils";
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

/** Block until every task-id is in a final state. */
async function waitForAll(taskIds: string[]): Promise<{
  succeeded: string[];
  failed: string[];
}> {
  const finals = ['succeed', 'finished', 'failed', 'warning'];
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
}: Args): Promise<void> => {   
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

        // Find instructions for debugPrintFiles - this is a simplified assumption
        // A more robust approach would be to get this from parsed node details like in genSrcFiles.ts
        const instructions = graph.nodes.map(n => ({ name: ((n as any).data)?.label?.replace(/\s+/g, '').toLowerCase() || 'unknown' })).filter(i => i.name !== 'unknown');

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

        // ───────────────────────── write graph-derived Rust sources ──────────────
        // 1) get the file tree result to check for existing program directory
        const treeTaskId = fileTreeTaskIds[0];
        const treeResult = await pollTaskStatus(treeTaskId);
        const initialTree = JSON.parse(treeResult.task.result ?? '[]');
        
        // 2) for now, assume a basic program structure exists or will be created
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

        // 3) build in-memory src/ tree
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
         * 4 ─ write the src tree into the workspace
         * --------------------------------------------------------------- */
        sendProgress({ stage: 'src-gen', message: 'Generating Rust sources…' });
        console.log('[GEN] Generated src tree:', JSON.stringify(srcTree, null, 2));

        // Gather existing paths so insertSrcFiles can decide create vs update
        const existing = new Set(flattenPaths(initialTree));
        const writeTaskIds = await insertSrcFiles(
          srcTree,
          projectId,
          existing,
          /* creatorId */ null
        );

        console.log('[GEN] insertSrcFiles returned taskIds =', writeTaskIds);

        if (writeTaskIds.length) {
          sendProgress({ stage: 'src-write', message: 'Writing Rust files…' });
          const { succeeded, failed } = await waitForAll(writeTaskIds);
          console.log('[GEN] src-write tasks done → ok:', succeeded, 'fail:', failed);

          if (failed.length) {
            sendProgress({
              stage: 'src-write-failed',
              message: `Rust write: ${failed.length} task(s) failed`,
            });
            throw new Error(`insertSrcFiles failed for ${failed.join(', ')}`);
          }
        } else {
          console.log('[GEN] insertSrcFiles produced no work (tree empty?)');
        }

        sendProgress({ stage: 'src-gen-done', message: 'Rust sources ready' });

        /* --------------------------------------------------------------- *
         * 5 ─ inject token-minting UI into Next.js app
         * --------------------------------------------------------------- */
        sendProgress({ stage: 'ui-gen', message: 'Generating token-minting UI…' });

        // Build the UI file tree
        const uiFiles = {
          name: ".",
          path: ".",
          type: "directory" as const,
          children: [
            {
              name: "app",
              path: "./app",
              type: "directory" as const,
              children: [
                { name: "page.tsx", path: "./app/page.tsx", type: "file" as const, code: HOME_PAGE_TSX },
                { name: "layout.tsx", path: "./app/layout.tsx", type: "file" as const, code: ROOT_LAYOUT_TSX }
              ]
            },
            {
              name: "src",
              path: "./src",
              type: "directory" as const,
              children: [
                {
                  name: "components",
                  path: "./src/components",
                  type: "directory" as const,
                  children: [
                    { name: "mint-form.tsx", path: "./src/components/mint-form.tsx", type: "file" as const, code: MINT_FORM_TSX },
                    { name: "token-created-success.tsx", path: "./src/components/token-created-success.tsx", type: "file" as const, code: TOKEN_CREATED_SUCCESS_TSX },
                    { name: "theme-toggle.tsx", path: "./src/components/theme-toggle.tsx", type: "file" as const, code: THEME_TOGGLE_TSX },
                    { name: "wallet.tsx", path: "./src/components/wallet.tsx", type: "file" as const, code: WALLET_TSX },
                    {
                      name: "ui",
                      path: "./src/components/ui",
                      type: "directory" as const,
                      children: [
                        { name: "button.tsx", path: "./src/components/ui/button.tsx", type: "file" as const, code: UI_BUTTON_TSX },
                        { name: "input.tsx", path: "./src/components/ui/input.tsx", type: "file" as const, code: UI_INPUT_TSX },
                        { name: "label.tsx", path: "./src/components/ui/label.tsx", type: "file" as const, code: UI_LABEL_TSX }
                      ]
                    }
                  ]
                },
                {
                  name: "context",
                  path: "./src/context",
                  type: "directory" as const,
                  children: [
                    { name: "WalletConnectionProvider.tsx", path: "./src/context/WalletConnectionProvider.tsx", type: "file" as const, code: WALLET_CONNECTION_PROVIDER_TSX }
                  ]
                },
                {
                  name: "lib",
                  path: "./src/lib",
                  type: "directory" as const,
                  children: [
                    { name: "utils.ts", path: "./src/lib/utils.ts", type: "file" as const, code: UTILS_TS }
                  ]
                },
                { name: "globals.css", path: "./src/globals.css", type: "file" as const, code: GLOBALS_CSS }
              ]
            },
            { name: "tailwind.config.js", path: "./tailwind.config.js", type: "file" as const, code: TAILWIND_CONFIG },
            { name: "postcss.config.js", path: "./postcss.config.js", type: "file" as const, code: POSTCSS_CONFIG },
            {
              name: "idl",
              path: "./idl",
              type: "directory" as const,
              children: [
                { name: "solanaflow_token.json", path: "./idl/solanaflow_token.json", type: "file" as const, code: "{}" }
              ]
            }
          ]
        } as FileTreeItem;

        // Insert the UI files
        console.log('[GEN] Inserting token-minting UI files into workspace');
        const uiWriteTaskIds = await insertSrcFiles(
          uiFiles,
          projectId,
          existing, // Reuse existing set to update rather than duplicate files
          /* creatorId */ null
        );

        console.log('[GEN] insertSrcFiles (UI) returned taskIds =', uiWriteTaskIds);

        if (uiWriteTaskIds.length) {
          sendProgress({ stage: 'ui-write', message: 'Writing UI files…' });
          const uiFilesResult = await waitForAll(uiWriteTaskIds);
          console.log('[GEN] UI write tasks done → ok:', uiFilesResult.succeeded, 'fail:', uiFilesResult.failed);
          
          if (uiFilesResult.failed.length) {
            sendProgress({
              stage: 'ui-write-failed',
              message: `UI write: ${uiFilesResult.failed.length} task(s) failed`,
            });
            console.warn(`[GEN] Some UI files failed to write: ${uiFilesResult.failed.join(', ')}`);
          } else {
            sendProgress({ stage: 'ui-gen-done', message: 'Token-minting UI ready' });
            
            // ─────────────────────── rebuild Next.js after UI injection ───────────────────────
            sendProgress({ stage: 'next-build', message: 'Re-building Next.js bundle…' });

            const nextBuildTaskId = `next-build-${Date.now()}`;

            // 1) reinstall deps (in case tailwind etc. were added) 
            // 2) run the build (emits .next/standalone/*)
            // 3) duplicate static + public into the standalone folder so server.js can serve them
            await runCommand(
              `docker exec ${workspace.containerName} bash -c "` +
              `set -e; cd /usr/share/solanaflow/web && ` +
              `yarn install --frozen-lockfile && ` +
              `yarn build && ` +
              `cp -R .next/static .next/standalone/.next/static && ` +
              `cp -R public .next/standalone/public"`,
              ".",
              nextBuildTaskId,
              { skipSuccessUpdate: true }   // we emit progress above; no auto status spam
            );
            sendProgress({ stage: 'next-build-done', message: 'Next bundle rebuilt' });
            // ───────────────────────────────────────────────────────────────────────────────────
          }
        } else {
          console.log('[GEN] insertSrcFiles for UI produced no work');
        }

        // ─────────── Run static lint on Cargo manifests before amending ───────────
        console.log('[GEN] Running static Cargo.toml linter...');
        try {
          await lintWorkspaceManifests({ projectId, userId, workspace });
          console.log('[GEN] Cargo.toml lint passed');
          sendProgress({ stage: 'lint-done', message: 'Cargo manifests validated' });
        } catch (error: unknown) {
          const lintError = error instanceof Error ? error : new Error(String(error));
          console.error('[GEN] Cargo.toml lint failed:', lintError);
          sendProgress({ stage: 'lint-failed', message: `Manifest validation failed: ${lintError.message}` });
          // Continue with amendConfigFiles even if lint fails, as it will fix the issues
        }

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

        // ────────────────────────── PATCH MANIFESTS ───────────────────────── */
        console.log('[GEN] calling amendConfigFiles (post-generation)…');
        const { anchorTaskId } = await amendConfigFiles(projectId, userId);
        console.log('[GEN] amendConfigFiles result:', { anchorTaskId });
        sendProgress({ stage: 'debug', message: '[handleGenerateCode] Amend done' });
    } catch (err) {
        console.error('Error in handleGenerateCode:', err);
        throw err;
    }
};

function flattenPaths(tree: any[]): string[] {
  const out: string[] = [];
  for (const n of tree ?? []) {
    if (n?.path) out.push(n.path);
    if (Array.isArray(n?.children)) out.push(...flattenPaths(n.children));
  }
  return out;
}
