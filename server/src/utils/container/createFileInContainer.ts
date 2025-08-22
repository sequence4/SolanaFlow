import { createTask, updateTaskStatus } from "../taskUtils/taskUtils";
import { runCommand } from "../command-execution/runCommand";
import { getProjectRootPath } from "../fileUtils/fileUtils";
import { ensureDirectoryExists } from "../taskUtils";
import { getContainerName } from "./getContainerName";

export async function createFileInContainer(
  projectId: string, 
  relativePath: string, 
  content: string,
  creatorId: string
): Promise<{ taskId: string }> {
  const containerName = await getContainerName(projectId);
  if (!containerName) {
    throw new Error(`No container found for project ${projectId}`);
  }

  const taskId = await createTask(`Create file ${relativePath}`, creatorId, projectId);

  setImmediate(async () => {
    try {
      const rootPath = await getProjectRootPath(projectId);
      
      const dirPath = relativePath.split('/').slice(0, -1).join('/');
      if (dirPath) {
        const fullDirPath = `/usr/src/${rootPath}/${dirPath}`;
        //console.log(`[DEBUG_FILE] Ensuring directory exists: ${fullDirPath}`);
        await ensureDirectoryExists(fullDirPath, containerName);
      }

      const writeCmd = `
        docker exec -i ${containerName} bash -c "cat > /usr/src/${rootPath}/${relativePath}" << 'EOF'
${content}
EOF`;
      
      await runCommand(writeCmd, '.', taskId);
      await updateTaskStatus(taskId, 'succeed', `File ${relativePath} created successfully`);
    } catch (error: any) {
      console.error(`Error creating file ${relativePath} in container:`, error);
      await updateTaskStatus(taskId, 'failed', `Failed to create file: ${error.message}`);
    }
  });

  return { taskId };
}