import { createTask } from "../taskUtils";
import { getContainerName } from "../container/getContainerName";
import { updateTaskStatus } from "../taskUtils";
import { runUserProjectCode } from "../compilation/runUserProjectCode";
import { runCommand } from "../command-execution/runCommand";
import { getProjectRootPath } from "../fileUtils";

export const startCustomCommandTask = async (
    projectId: string,
    creatorId: string,
    commandType: 'anchor clean' | 'cargo clean' | 'runFunction',
    functionName?: string,
    parameters?: any[],
    ephemeralPubkey?: string,
  ): Promise<string> => {
    const taskId = await createTask(
      commandType === 'runFunction' ? `Run Function: ${functionName}` : commandType, 
      creatorId, 
      projectId
    );
  
    setImmediate(async () => {
      try {
        const containerName = await getContainerName(projectId);
        if (!containerName) {
          throw new Error(`No container found for project ${projectId}`);
        }
        
        if (commandType === 'runFunction' && functionName) {
          await updateTaskStatus(taskId, 'doing', `Executing function ${functionName}...`);
          try {
            const output = await runUserProjectCode(projectId, taskId, parameters, ephemeralPubkey);
            if (output.includes('ERROR:')) {
              throw new Error(output.split('ERROR:')[1].trim());
            }
            try {
              const parsedResult = JSON.parse(output);
              await updateTaskStatus(taskId, 'succeed', JSON.stringify(parsedResult));
            } catch (parseError) {
              const wrappedResult = { message: output };
              await updateTaskStatus(taskId, 'succeed', JSON.stringify(wrappedResult));
            }
          } catch (error: any) {
            console.error(`Error executing function:`, error);
            await updateTaskStatus(taskId, 'failed', `Error executing function: ${error.message}`);
          }
        } else {
          const rootPath = await getProjectRootPath(projectId);
          
          await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && ${commandType}"`, '.', taskId);
        }
      } catch (error: any) {
        await updateTaskStatus(taskId, 'failed', `Error: ${error.message}`);
      }
    });
  
    return taskId;
  };
  