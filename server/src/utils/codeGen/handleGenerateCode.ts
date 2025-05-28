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
    console.log('[GEN] first node  =', graph.nodes[0]);
    
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
            console.log('[GEN] first 200 chars of combined code:\n',
                functionParts.join('\n\n').slice(0, 200));
        }

        if (functionParts.length > 0) functionCode = functionParts.join('\n\n');
        else console.log('No valid function code found in nodes');

        console.log('DEBUG handleGenerateCode functionCode:', functionCode);

        //const frontendTaskId = await genUi(nodes);   // possible skip this step if not working correctly (save til end) 
        
        console.log('[GEN] calling amendConfigFiles…');
        const { anchorTaskId } = await amendConfigFiles(projectId, userId);
        console.log('[GEN] amendConfigFiles result:', { anchorTaskId });
        sendProgress({ stage: 'debug', message: '[handleGenerateCode] Amend done' });
        
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
        await ensureAnchorTomlProgram(workspace, programName, programId);
        await ensureRootWorkspaceMembers(workspace);

        // 3) build in-memory src/ tree
        const srcTree = genSrcFiles({ nodes: graph.nodes, edges: graph.edges || [] }, programName, programId);
        if (!srcTree) throw new Error('genSrcFiles returned null');
        
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
          /* basePath */ `${workspace.rootPath}/programs/${programName}`,
          /* creatorId */ null,
          workspace.containerName
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
              ...instructions.map(i => `programs/${programName}/src/instructions/${i.name}.rs`),
            ];
            // Add state.rs to important files if state exists
            const { state } = parseNodeDetails({ nodes: graph.nodes, edges: graph.edges || [] });
            if (state.length > 0) {
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
