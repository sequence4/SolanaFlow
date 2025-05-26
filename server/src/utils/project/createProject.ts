/**
 * utils/project/createProject.ts
 *
 * This task builds the Anchor + CRA + Express directory tree *inside*
 * a container whose lifecycle is managed elsewhere (either a warm pool
 * entry or one started by `prepEnv`).  We **never** call `docker run`
 * here – if the DB has no `container_name` for the project we bail out
 * and let the upstream logic decide how to recover.
 */

import {
    createTask,
    updateTaskStatus,
  } from '../taskUtils';                     // ← utilities live one level up
  import {
    getContainerName,
    runCommand,                                 // exported by utils/projectUtils.ts
  } from '../projectUtils';
  
  /**
   * Kick off the directory-scaffolding process inside an existing container.
   *
   * @param creatorId   – authenticated user that triggered the action
   * @param rootPath    – slug-safe directory name for this project
   * @param projectId   – UUID of the SolanaFlow project
   * @param projectDesc – Short README description (defaults to CRA boiler-plate)
   */
  export const startCreateProjectDirectoryTask = async (
    creatorId   : string,
    rootPath    : string,
    projectId   : string,
    projectDesc = 'A React application'
  ): Promise<string> => {
    if (!projectId) throw new Error('Project ID is required');
  
    const taskId          = await createTask('Create Project Directory', creatorId, projectId);
    const sanitizedTaskId = taskId.trim().replace(/,$/, '');
  
    // Off-thread, so the API can return immediately
    setImmediate(async () => {
      try {
        /* ------------------------------------------------------------- *
         * 1. Re-use the container already recorded in `solanaproject`.  *
         *    We purposely avoid `docker run` here – if no container     *
         *    exists it means `prepEnv` failed earlier.                  *
         * ------------------------------------------------------------- */
        const containerName = await getContainerName(projectId);
        if (!containerName) throw new Error(`No container recorded for project ${projectId}`);
  
        /* ------------------------------------------------------------- *
         * 2. Anchor project root (e.g. `anchor init my-proj`)           *
         * ------------------------------------------------------------- */
        await runCommand(
          `docker exec ${containerName} bash -c "cd /usr/src && anchor init ${rootPath}"`,
          '.',
          sanitizedTaskId,
          { skipSuccessUpdate: true },
        );
  
        /* 3. CRA TypeScript template ---------------------------------- */
        await runCommand(
          `docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && npx create-react-app@latest app --template typescript"`,
          '.',
          sanitizedTaskId,
          { skipSuccessUpdate: true },
        );
  
        /* 4. Express skeleton ---------------------------------------- */
        await runCommand(
          `docker exec ${containerName} bash -c "mkdir -p /usr/src/${rootPath}/server/src"`,
          '.',
          sanitizedTaskId,
          { skipSuccessUpdate: true },
        );
  
        /* ------------------------------------------------------------- *
         * (Remaining file-creation & dependency-installation steps      *
         *  can remain exactly as they were – they already target the    *
         *  correct container / paths.)                                  *
         * ------------------------------------------------------------- */
  
        await updateTaskStatus(
          sanitizedTaskId,
          'succeed',
          `Project directories created inside container ${containerName}`,
        );
      } catch (err: any) {
        await updateTaskStatus(sanitizedTaskId, 'failed', err.message);
        console.error('[startCreateProjectDirectoryTask] error:', err);
      }
    });
  
    return sanitizedTaskId;
  };
  