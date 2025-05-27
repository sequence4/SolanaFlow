import { startGenerateFileTreeTask, getProjectRootPath } from '../fileUtils';
import { pollTaskStatus } from '../taskUtils';

/**
 * Server-side helper that triggers a file-tree refresh inside the container,
 * waits for the task to finish, and returns the task-ids involved.
 *
 * @param projectId         UUID of the SolanaFlow project
 * @param userId            User ID for task creation
 * @param afterCodeGen      true when called right after code-gen (kept for API parity)
 */
export async function mergeFileTree(
  projectId: string,
  userId: string,
  afterCodeGen: boolean = true,
): Promise<string[]> {

  const allTaskIds: string[] = [];

  try {
    // Get the project root path
    const rootPath = await getProjectRootPath(projectId);
    
    // kick off the backend task that builds a fresh file tree
    const taskId = await startGenerateFileTreeTask(projectId, rootPath, userId);
    allTaskIds.push(taskId);

    // block until the task reaches a terminal state
    await pollTaskStatus(taskId);

    // Later we can add Cargo/Anchor.toml tweaks here, but for now
    // the deploy pipeline only needs the side-effect of the refresh.
    return allTaskIds;
  } catch (error) {
    console.error('Error in mergeFileTree:', error);
    return allTaskIds;
  }
}
