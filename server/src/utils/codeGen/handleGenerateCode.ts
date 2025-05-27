import { mergeFileTree } from './mergeFileTree';
//import { genUi } from './genUi';
import { Graph } from '../../types/graph';
import type { WorkspaceHandle } from '../deploy/prepEnv';
import { amendConfigFiles } from './amendConfigFiles';


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
        
       
        const fileTreeTaskIds = await mergeFileTree(projectId, userId);
    } catch (err) {
        console.error('Error in handleGenerateCode:', err);
        throw err;
    }
};
