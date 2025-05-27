import { refreshWorkspaceTree } from './refreshWorkspaceTree';
//import { genUi } from './genUi';
import { Graph } from '../../types/graph';
import type { WorkspaceHandle } from '../deploy/prepEnv';
import { amendConfigFiles } from './amendConfigFiles';
import { pollTaskStatus } from '../taskUtils';

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
    } catch (err) {
        console.error('Error in handleGenerateCode:', err);
        throw err;
    }
};
