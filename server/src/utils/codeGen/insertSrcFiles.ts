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
  onFile: (path: string, content: string) => void = () => {},
): Promise<string[]> {
  const fileTaskIds: string[] = [];
  const queue: { node: FileTreeItem }[] = [
    { node: rootNode },
  ];

  console.log(`[DEBUG_INSERT_SRC] Starting insertion for project: ${projectId}`);

  while (queue.length > 0) {
    const { node } = queue.shift()!;
    // node.path is already like "./programs/my_program/src/lib.rs"
    // We need a clean relative path for existingFilePaths check and for updateOrCreateFile
    const projectRelativePath = node.path.replace(/^\.?\//, ''); 

    if (node.type === 'directory') {
      console.log(`[DEBUG_INSERT_SRC] Processing directory: ${projectRelativePath}`);
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
      console.log(`[DEBUG_INSERT_SRC] Processing file: ${projectRelativePath}`);
      // Don't log file content, just log the file size
      const contentSize = node.code ? Buffer.byteLength(node.code) : 0;
      console.log(`[DEBUG_INSERT_SRC] File size: ${contentSize} bytes`);

      if (projectRelativePath === "web/tsconfig.json") {
        console.log("[DEBUG_INSERT_SRC] About to process tsconfig.json - exists in paths?", existingFilePaths.has(projectRelativePath));
      }

      const taskId = await updateOrCreateFile(
        projectId,
        projectRelativePath, 
        node.code || '',
        existingFilePaths,
        creatorId
      );
      if (taskId) {
        console.log(`[DEBUG_INSERT_SRC] Added taskId ${taskId} for file: ${projectRelativePath}`);
        
        if (projectRelativePath === "web/tsconfig.json") {
          console.log("[DEBUG_INSERT_SRC] taskId for tsconfig.json =", taskId);
        }
        
        // stream the file *now* – don't block the queue
        if (onFile) onFile(projectRelativePath, node.code || '');
        
        fileTaskIds.push(taskId);
      }
    }
  }

  console.log(`[DEBUG_INSERT_SRC] Completed. Returning ${fileTaskIds.length} task IDs.`);
  return fileTaskIds;
}
