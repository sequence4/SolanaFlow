import { createTask } from "../taskUtils";
import { getContainerName } from "../container/getContainerName";
import { getProjectRootPath } from "../fileUtils";
import { runCommand } from "../command-execution/runCommand";
import { updateTaskStatus } from "../taskUtils";

export const startAnchorTestTask = async (
  projectId: string,
  creatorId: string
): Promise<string> => {
  const taskId = await createTask('Anchor Test', creatorId, projectId);
  const sanitizedTaskId = taskId.trim().replace(/,$/, '');

  setImmediate(async () => {
    try {
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }
      
      const rootPath   = await getProjectRootPath(projectId);
      const rootStem   = rootPath.replace(/-[a-f0-9]{8}$/, '');
      let programName  = rootStem.replace(/-/g, '_');
      if (/^[0-9]/.test(programName)) programName = 'p' + programName;
      
      const testCmd=`
        docker exec ${containerName} bash -c '
          cd /usr/src/${rootPath} &&
            anchor test -p ${programName} -- --jobs 1
        '
      `;
      await runCommand(testCmd.trim(), '.', taskId);
    } catch (error: any) {
      await updateTaskStatus(sanitizedTaskId, 'failed', `Error: ${error.message}`);
    }
  });

  return taskId;
};