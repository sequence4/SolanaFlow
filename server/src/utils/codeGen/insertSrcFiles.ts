import { updateOrCreateFile } from '../fileUtils';
import type { FileTreeItem } from '../../types/FileTreeItem';
import path from 'path';

// Define the callback type for file write progress
export type InsertSrcProgressFn = (item: FileTreeItem) => void;

export async function insertSrcFiles(
  rootNode: FileTreeItem,
  projectId: string,
  existingFilePaths: Set<string>,
  // basePath?: string, // Keep original basePath if needed by calling logic, or remove if rootPath from handleGenerateCode is always project root
  creatorId: string | null = null,
  onFile: (path: string, content: string) => Promise<void> = async () => {},
): Promise<string[]> {
  const fileTaskIds: string[] = [];
  const queue: { node: FileTreeItem }[] = [
    { node: rootNode },
  ];

  //console.log(`[INSERT] Starting file insertion for project ${projectId}`);

  while (queue.length > 0) {
    const { node } = queue.shift()!;
    // node.path is already like "./programs/my_program/src/lib.rs"
    // We need a clean relative path for existingFilePaths check and for updateOrCreateFile
    const projectRelativePath = node.path.replace(/^\.?\//, ''); 

    if (node.type === 'directory') {
      console.log(`[INSERT] Processing directory: ${projectRelativePath}`);
      // ── ensure empty dir is materialised ──
      if (!node.children?.length) {
        await updateOrCreateFile(
          projectId,
          path.posix.join(projectRelativePath, '.keep'),
          '',
          existingFilePaths,
          creatorId
        );
      }
      // mkdir -p is handled by startCreateFileTask if a file is created in a new dir
      // If we need to ensure empty dirs are created, a separate mechanism or specific call would be needed.
      // For now, relying on file creation to make parent dirs.
      if (node.children) {
        for (const child of node.children) {
          // Children paths are relative to their parent, but node.path should be full relative path
          queue.push({ node: child });
        }
      }
    } else if (node.type === 'file') {
      // Log only file path without content
      //console.log(`[INSERT] Processing file: ${projectRelativePath}`);
      //console.log(`[INSERT] File has code: ${!!node.code}, code length: ${node.code?.length || 0}`);
      //console.log(`[INSERT] Content preview (first 100 chars):`, (node.code || '').substring(0, 100));
      
      // Special handling for tsconfig.json
      if (projectRelativePath === "web/tsconfig.json") {
        //console.log("[INSERT] Processing tsconfig.json file");
      }

      const taskId = await updateOrCreateFile(
        projectId,
        projectRelativePath, 
        node.code || '',
        existingFilePaths,
        creatorId
      );
      if (taskId) {
       // console.log(`[INSERT] File task created for: ${projectRelativePath}`);
        //console.log(`[INSERT] About to call onFile with content length: ${(node.code || '').length}`);
        
        // stream the file *now* – don't block the queue
        if (onFile) await onFile(projectRelativePath, node.code || '');
        
        fileTaskIds.push(taskId);
      }
    }
  }

  //console.log(`[INSERT] Completed file insertion with ${fileTaskIds.length} tasks`);
  return fileTaskIds;
}
