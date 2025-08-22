import { createTask } from "../taskUtils";
import { getContainerName } from "../container/getContainerName";
import { updateTaskStatus } from "../taskUtils";
import pool from "../../config/database";
import { normalizeProjectName } from "../stringUtils";
import { runCommand } from "../command-execution/runCommand";

export const startInstallNodeDependenciesTask = async (
  projectId: string,
  creatorId: string,
  packages: string[],
  targetDir: 'app' | 'server' = 'app'
): Promise<string> => {
  const taskId = await createTask('Install Node Dependencies', creatorId, projectId);
  //console.log(`Starting node dependency installation task for project ${projectId} with packages:`, packages);

  setImmediate(async () => {
    try {
      if (packages.length === 0) {
        //console.log(`No packages to install for project ${projectId}`);
        await updateTaskStatus(taskId, 'succeed', 'No packages to install');
        return;
      }
      
      const containerName = await getContainerName(projectId);
      
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }
      
      const rootPathResult = await pool.query(
        'SELECT name FROM solanaproject WHERE id = $1',
        [projectId]
      );
      
      let rootPath = '';
      if (rootPathResult.rows.length > 0) {
        rootPath = normalizeProjectName(rootPathResult.rows[0].name);
      } else {
        throw new Error(`Could not determine project name for project ${projectId}`);
      }
      
      //console.log(`Found container ${containerName} for project ${projectId}`);
      
      await updateTaskStatus(taskId, 'doing', `Adding ${packages.join(', ')} to package.json in ${targetDir}...`);
      //console.log(`Adding packages to package.json: ${packages.join(', ')} for project ${projectId} in ${targetDir}`);
      
      try {
        // Instead of direct npm install, add each package to package.json
        for (const pkg of packages) {
          // ① write the dep into package.json (npm pkg set keeps formatting)
          // npm pkg set requires the whole arg in one quoted string; avoid slash-escaping hell
          const addDeps = `npm pkg set "dependencies.${pkg}@latest"`;
          // ② touch a stamp file – the Dockerfile COPY line already invalidates on it
          const stampPath = `/usr/src/${rootPath}/.force-reinstall`;
          // CRA lives under /app, Next.js under /web; respect caller's targetDir
          const subDir = targetDir === 'app' ? 'web' : targetDir;   // <- tweak if you use CRA elsewhere
          const cmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath}/${subDir} && ${addDeps} && date > ${stampPath}"`;
          await runCommand(cmd, '.', taskId);
        }
        
        //console.log(`Successfully added packages to package.json in ${containerName} (${targetDir})`);
        await updateTaskStatus(taskId, 'succeed', `Dependencies added to package.json in ${targetDir}. They will be installed on next container rebuild.`);
      } catch (error: any) {
        console.error(`Failed to add packages to package.json. Error:`, error);
        await updateTaskStatus(taskId, 'failed', `Error adding dependencies to package.json: ${error.message}`);
      }
    } catch (error: any) {
      console.error(`Error in startInstallNodeDependenciesTask:`, error);
      await updateTaskStatus(taskId, 'failed', `Error: ${error.message}`);
    }
  });

  return taskId;
};