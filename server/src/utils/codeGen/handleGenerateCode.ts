import { mergeFileTree } from './mergeFileTree';
import { amendConfigFile } from './amendConfigFile';
import { insertFrontendUIFiles } from './insertFrontendUIFiles';

export const handleGenerateCode = async (nodes: any[]) => {    
    try {
        if(nodes.length === 0) throw new Error('No nodes found');
        let functionCode = null;
        const functionParts = nodes.map((node) => {
            if (node.data && node.data.code) return node.data.code;
            else return null;
        }).filter(Boolean);
        if (functionParts.length > 0) functionCode = functionParts.join('\n\n');
        else console.log('No valid function code found in nodes');
        const frontendTaskId = await insertFrontendUIFiles(projectContext.id);                
        const cargoResponse = await amendConfigFile(projectContext.id, 'Cargo.toml', 'Cargo.toml');        
        const anchorResponse = await amendConfigFile(projectContext.id, 'Anchor.toml', 'Anchor.toml');
        const fileTreeTaskIds = await mergeFileTree(projectContext, setFileTree, setProjectContext, true);
        const fileTreeResponse = await fileApi.getProjectFileTree(projectContext.id);
        const fileTreeResult = await taskApi.getTask(fileTreeResponse.taskId);
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