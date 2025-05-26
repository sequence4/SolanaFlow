//import { mergeFileTree } from './mergeFileTree';
//import { amendConfigFiles } from './amendConfigFiles';
//import { genUi } from './genUi';
import { getProjectFileTree } from 'src/controllers/fileController';
import { getTaskStatus } from 'src/controllers/taskController';
import { Graph } from '../../types/graph';
import type { WorkspaceHandle } from '../deploy/prepEnv';

interface Args {
  projectId: string;
  graph: Graph;
  workspace: WorkspaceHandle;
  sendProgress: (data: unknown) => void;
}

export const handleGenerateCode = async ({
  projectId,
  graph,
  workspace,
  sendProgress,
}: Args): Promise<void> => {   
    console.log('DEBUG handleGenerateCode function:', { nodesLen: graph.nodes.length, projectId });
 
    try {
        if (graph.nodes.length === 0) throw new Error('No nodes found');
        let functionCode = null;

        const functionParts = graph.nodes
            .map(node => (node.config.code as string || null))
            .filter(Boolean);

        if (functionParts.length > 0) functionCode = functionParts.join('\n\n');
        else console.log('No valid function code found in nodes');

        console.log('DEBUG handleGenerateCode functionCode:', functionCode);

        /*
        const frontendTaskId = await genUi(nodes);   // possible skip this step if not working correctly (save til end) 
        
        const { cargoTaskId, anchorTaskId } = await amendConfigFiles(projectId)

        const fileTreeTaskIds = await mergeFileTree(projectId, true);
        
        const fileTreeResponse = await getProjectFileTree(projectId);
        const fileTreeResult = await getTaskStatus(fileTreeResponse.taskId);

        const existingTree = fileTreeResult.task.result ? JSON.parse(fileTreeResult.task.result) : [];
        const flattenTree = (tree: any[]): string[] => {
            const paths: string[] = [];
            for (const item of tree || []) {
                if (item.path) paths.push(item.path);
                if (item.children) paths.push(...flattenTree(item.children));
            }
            return paths;
        };
        const allPaths = flattenTree(existingTree);
        const instructionFiles = allPaths.filter(path => path.includes('/instructions/') && path.endsWith('.rs'));
        */
    } catch (err) {
        console.error('Error in handleGenerateCode:', err);
        throw err;
    }
};
