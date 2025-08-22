import { createTask } from "../taskUtils";
import { getContainerName } from "./getContainerName";
import { runCommand } from "../command-execution/runCommand";
import { updateTaskStatus } from "../taskUtils";
import { getProjectRootPath } from "../fileUtils";

export async function getFileContentFromContainer(
  projectId: string, 
  relativePath: string,
  creatorId: string
): Promise<{ taskId: string }> {
  const containerName = await getContainerName(projectId);
  if (!containerName) {
    throw new Error(`No container found for project ${projectId}`);
  }

  const taskId = await createTask(`Get file content for ${relativePath}`, creatorId, projectId);

  setImmediate(async () => {
    try {
      const rootPath = await getProjectRootPath(projectId);
      
      const readCmd = `docker exec ${containerName} cat /usr/src/${rootPath}/${relativePath}`;
      const content = await runCommand(readCmd, '.', taskId);
      
      await updateTaskStatus(taskId, 'succeed', content);
    } catch (error: any) {
      console.error(`Error reading file ${relativePath} from container:`, error);
      await updateTaskStatus(taskId, 'failed', `Failed to read file: ${error.message}`);
    }
  });

  return { taskId };
}