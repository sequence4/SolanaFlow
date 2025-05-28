import { updateOrCreateFile } from '../fileUtils';
import type { FileTreeItem } from '../../types/FileTreeItem';
import { ensureDirectoryExists } from '../taskUtils'; // Assuming ensureDirectoryExists is in taskUtils or similar

export async function insertSrcFiles(
  rootNode: FileTreeItem,
  projectId: string,
  existingFilePaths: Set<string>,
  baseContainerPath: string, // e.g., /usr/src/project_root
  creatorId: string | null = null,
  containerName: string // Needed for ensureDirectoryExists
): Promise<string[]> {
  const fileTaskIds: string[] = [];
  const queue: { node: FileTreeItem; currentPath: string }[] = [
    { node: rootNode, currentPath: baseContainerPath },
  ];

  console.log(`[DEBUG_INSERT_SRC] Starting insertion at base container path: ${baseContainerPath}`);

  while (queue.length > 0) {
    const { node, currentPath } = queue.shift()!;
    const nodeAbsolutePath = `${currentPath}/${node.name}`.replace(/\/\//g, '/'); // Normalize path

    if (node.type === 'directory') {
      console.log(`[DEBUG_INSERT_SRC] Ensuring directory: ${nodeAbsolutePath}`);
      // ensureDirectoryExists needs the absolute path within the container
      await ensureDirectoryExists(nodeAbsolutePath, containerName);

      if (node.children) {
        for (const child of node.children) {
          queue.push({ node: child, currentPath: nodeAbsolutePath });
        }
      }
    } else if (node.type === 'file') {
      // updateOrCreateFile expects a path relative to the project root for existingFilePaths check,
      // but an absolute path for the actual write command (handled internally by updateOrCreateFile based on its needs)
      // Here, node.path is relative like "./programs/my_program/src/lib.rs"
      // We need to adjust how existingFilePaths are checked or how paths are passed.
      // For simplicity, let's assume node.path is what existingFilePaths expects.
      // The actual write will be to nodeAbsolutePath by updateOrCreateFile, which gets it via its filePath param.
      
      const relativePathForCheck = node.path.startsWith('./') ? node.path.substring(2) : node.path;
      const projectRelativePath = nodeAbsolutePath.replace(baseContainerPath + '/', '');

      console.log(`[DEBUG_INSERT_SRC] Processing file: ${projectRelativePath} (abs: ${nodeAbsolutePath})`);
      console.log(`[DEBUG_INSERT_SRC] Code to write (first 50 chars): ${node.code?.substring(0,50)}`);

      const taskId = await updateOrCreateFile(
        projectId,
        projectRelativePath, // This path should match what's in existingFilePaths and be relative to project root
        node.code || '',
        existingFilePaths,
        creatorId
      );
      if (taskId) {
        console.log(`[DEBUG_INSERT_SRC] Added taskId ${taskId} for file: ${projectRelativePath}`);
        fileTaskIds.push(taskId);
      }
    }
  }

  console.log(`[DEBUG_INSERT_SRC] Completed. Returning ${fileTaskIds.length} task IDs.`);
  return fileTaskIds;
}
