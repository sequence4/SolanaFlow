import { createTask } from "../taskUtils";
import { getContainerName } from "../container/getContainerName";
import { getProjectRootPath } from "../fileUtils";
import { runCommand } from "../command-execution/runCommand";
import { updateTaskStatus } from "../taskUtils";

export const startSetClusterTask = async (
    projectId: string,
    creatorId: string
  ): Promise<string> => {
    const taskId = await createTask('Anchor Config Set Devnet', creatorId, projectId);
  
    setImmediate(async () => {
      try {
        const containerName = await getContainerName(projectId);
        if (!containerName) {
          throw new Error(`No container found for project ${projectId}`);
        }
  
        const rootPath = await getProjectRootPath(projectId);
  
        await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && anchor config set cluster devnet"`, '.', taskId);
      } catch (error: any) {
        console.error('Error setting anchor cluster:', error.message);
        await updateTaskStatus(taskId, 'failed', `Error: ${error.message}`);
      }
    });
  
    return taskId;
  };