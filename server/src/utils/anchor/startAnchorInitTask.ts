import { getContainerName } from "../container/getContainerName";
import { createTask } from "../taskUtils";
import { runCommand } from "../command-execution/runCommand";
import { updateTaskStatus } from "../taskUtils";

export const startAnchorInitTask = async (
  projectId: string,
  rootPath: string,
  projectName: string,
  creatorId: string
): Promise<string> => {
  const taskId = await createTask('Anchor Init', creatorId, projectId);
  setImmediate(async () => {
    try {
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }
      
      const result = await runCommand(`docker exec ${containerName} bash -c "cd /usr/src && anchor init ${rootPath}"`, '.', taskId);
      return result;
    } catch (error: any) {
      console.error('Error in anchor init task:', error);
      await updateTaskStatus(taskId, 'failed', `Error: ${error.message}`);
    }
  });
  return taskId;
};