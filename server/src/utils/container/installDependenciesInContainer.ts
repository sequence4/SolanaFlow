import { getContainerName } from "./getContainerName";
import { createTask } from "../taskUtils";
import { updateTaskStatus } from "../taskUtils";
import { getProjectRootPath } from "../fileUtils";
import { ensureDirectoryExists } from "../taskUtils";
import { runCommand } from "../command-execution/runCommand";

export async function installDependenciesInContainer(
    projectId: string,
    packages: string[],
    creatorId: string,
    targetDir: 'app' | 'server' = 'app'
  ): Promise<{ taskId: string }> {
    const containerName = await getContainerName(projectId);
    if (!containerName) {
      throw new Error(`No container found for project ${projectId}`);
    }
  
    const taskId = await createTask(`Install dependencies in ${targetDir}`, creatorId, projectId);
  
    setImmediate(async () => {
      try {
        const rootPath = await getProjectRootPath(projectId);
  
        const targetPath = `/usr/src/${rootPath}/${targetDir}`;
        //console.log(`[DEBUG_FILE] Ensuring target directory exists for dependencies: ${targetPath}`);
        await ensureDirectoryExists(targetPath, containerName);
        
        const packageList = packages.join(' ');
        const installCmd = `docker exec ${containerName} bash -c "cd ${targetPath} && npm install ${packageList}"`;
        
        const result = await runCommand(installCmd, '.', taskId);
        await updateTaskStatus(taskId, 'succeed', `Packages installed successfully: ${packageList}`);
      } catch (error: any) {
        console.error(`Error installing packages in container:`, error);
        await updateTaskStatus(taskId, 'failed', `Failed to install packages: ${error.message}`);
      }
    });
  
    return { taskId };
  } 