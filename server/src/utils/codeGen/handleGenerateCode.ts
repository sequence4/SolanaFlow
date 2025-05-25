import { mergeFileTree } from './mergeFileTree';
import { amendConfigFiles } from './amendConfigFiles';
//import { genUi } from './genUi';
import { getProjectFileTree } from 'src/controllers/fileController';
import { getTaskStatus } from 'src/controllers/taskController';


export const handleGenerateCode = async (nodes: any[], projectId: string) => {    
    try {
        if(nodes.length === 0) throw new Error('No nodes found');
        let functionCode = null;
        
        const functionParts = nodes.map((node) => {
            if (node.data && node.data.code) return node.data.code;
            else return null;
        }).filter(Boolean);

        if (functionParts.length > 0) functionCode = functionParts.join('\n\n');
        else console.log('No valid function code found in nodes');

        //const frontendTaskId = await genUi(nodes);   // possible skip this step if not working correctly (save til end) 
                   
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
    } catch (err) {
        console.error('Error in handleGenerateCode:', err);
    }
};