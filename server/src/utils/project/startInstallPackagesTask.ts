import { createTask } from "../taskUtils";
import { runCommand } from "../command-execution/runCommand";
import { getProjectRootPath } from "../fileUtils";
import { updateTaskStatus } from "../taskUtils";
import { getContainerName } from "../container/getContainerName";

export const startInstallPackagesTask = async (
  projectId: string,
  creatorId: string,
  _packages?: string[]
): Promise<string> => {
  const taskId = await createTask('Install NPM Packages', creatorId, projectId);

  setImmediate(async () => {
    try {
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }
      
      const rootPath = await getProjectRootPath(projectId);
      
      // Instead of direct npm install, we add the packages to package.json
      // and touch a stamp file that will force a rebuild on next Docker build
      
      // Add standard packages
      const standardPackages = [
        '@coral-xyz/anchor',
        '@solana/web3.js',
        '@solana/spl-token',
        'fs'
      ];
      
      for (const pkg of standardPackages) {
        // ① write the dep into package.json (npm pkg set keeps formatting)
        // npm pkg set requires the whole arg in one quoted string; avoid slash-escaping hell
        const addDeps = `npm pkg set "dependencies.${pkg}@latest"`;
        // ② touch a stamp file – the Dockerfile COPY line already invalidates on it
        const stampPath = `/usr/src/${rootPath}/.force-reinstall`;
        const cmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && ${addDeps} && date > ${stampPath}"`;
        await runCommand(cmd, '.', taskId);
      }

      // Add custom packages
      if (_packages) {
        for (const pkg of _packages) {
          // npm pkg set requires the whole arg in one quoted string; avoid slash-escaping hell
          const addDeps = `npm pkg set "dependencies.${pkg}@latest"`;
          const stampPath = `/usr/src/${rootPath}/.force-reinstall`;
          const cmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && ${addDeps} && date > ${stampPath}"`;
          await runCommand(cmd, '.', taskId);
        }
      }
      
      await updateTaskStatus(taskId, 'succeed', 'Dependencies added to package.json. They will be installed on next container rebuild.');
    } catch (error: any) {
      await updateTaskStatus(taskId, 'failed', `Error: ${error.message}`);
    }
  });

  return taskId;
};