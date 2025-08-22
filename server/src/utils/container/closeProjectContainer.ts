import { runCommand } from "../projectUtils";
import { createTask } from "../taskUtils";
import { getContainerName } from "./getContainerName";
import { updateTaskStatus } from "../taskUtils";
import { pruneContainerResources } from "./pruneContainer";
import pool from "../../config/database";

export const closeProjectContainer = async (
    projectId: string,
    creatorId: string,
    commitBeforeClose: boolean = false,
    removeContainer: boolean = false
  ): Promise<string> => {
    const taskId = await createTask('Close Project Container', creatorId, projectId);
    const sanitizedTaskId = taskId.trim().replace(/,$/, '');
  
    setImmediate(async () => {
      try {
        const containerName = await getContainerName(projectId);
        
        if (!containerName) {
          throw new Error(`No container found for project ${projectId}`);
        }
        
        //console.log(`Closing container ${containerName} for project ${projectId}`);
        
        if (commitBeforeClose) {
          try {
            const checkGitCmd = `docker exec ${containerName} bash -c "if [ -d /usr/src/.git ]; then echo 'git-exists'; else echo 'no-git'; fi"`;
            const gitExists = await runCommand(checkGitCmd, '.', sanitizedTaskId);
            
            if (gitExists.trim() === 'git-exists') {
              //console.log(`Git repository found in container ${containerName}, committing changes...`);
              
              const commitCmd = `
                docker exec ${containerName} bash -c "
                  cd /usr/src &&
                  git add . &&
                  git commit -m 'Changes before container close - $(date)' || true &&
                  git push origin main || true
                "
              `;
              await runCommand(commitCmd, '.', sanitizedTaskId);
            } else {
              console.log(`No Git repository found in container ${containerName}, skipping commit`);
            }
          } catch (gitError: any) {
            console.error(`Error during Git operations:`, gitError);
          }
        }
        
        if (removeContainer) {
          pruneContainerResources(containerName, projectId);
          // clear DB pointer – keep row for audit
          await pool.query(
            `UPDATE solanaproject
                SET container_name = NULL,
                    container_url  = NULL
              WHERE id = $1`,
            [projectId]
          );
         // console.log(`Container ${containerName} and all project-labelled resources pruned`);
        } else {
          await runCommand(`docker stop ${containerName}`, '.', sanitizedTaskId);
          console.log(`Container ${containerName} stopped (kept for warm pool)`);
        }
        
        await updateTaskStatus(
          sanitizedTaskId,
          'succeed',
          `Container ${containerName} for project ${projectId} ${removeContainer ? 'stopped and removed' : 'stopped'} successfully`
        );
      } catch (error: any) {
        console.error(`Error closing project container:`, error);
        await updateTaskStatus(
          sanitizedTaskId,
          'failed',
          `Error closing project container: ${error.message}`
        );
      }
    });
    
    return sanitizedTaskId;
  };