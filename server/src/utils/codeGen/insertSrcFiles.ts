import { updateOrCreateFile } from '../fileUtils';
import type { FileTreeItem } from '../../types/FileTreeItem';
import path from 'path';
import { waitForTaskCompletion } from '../taskUtils';

// Define the callback type for file write progress
export type InsertSrcProgressFn = (item: FileTreeItem) => void;

export async function insertSrcFiles(
  rootNode: FileTreeItem,
  projectId: string,
  existingFilePaths: Set<string>,
  // basePath?: string, // Keep original basePath if needed by calling logic, or remove if rootPath from handleGenerateCode is always project root
  creatorId: string | null = null,
  onFileWritten?: InsertSrcProgressFn,
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
      console.log(`[DEBUG_INSERT_SRC] Code to write (first 50 chars): ${node.code?.substring(0,50)}`);

      const taskId = await updateOrCreateFile(
        projectId,
        projectRelativePath, 
        node.code || '',
        existingFilePaths,
        creatorId
      );
      if (taskId) {
        console.log(`[DEBUG_INSERT_SRC] Added taskId ${taskId} for file: ${projectRelativePath}`);
        
        // Wait for the task to complete
        await waitForTaskCompletion(taskId, 90, 2_000);
        
        // Notify caller that file is written
        if (onFileWritten) {
          onFileWritten(node);
        }
        
        fileTaskIds.push(taskId);
      }
    }
  }

  console.log(`[DEBUG_INSERT_SRC] Completed. Returning ${fileTaskIds.length} task IDs.`);
  return fileTaskIds;
}
