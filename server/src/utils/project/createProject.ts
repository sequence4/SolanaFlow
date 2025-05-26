/**
 * utils/project/createProject.ts
 *
 * This task builds the Anchor workspace **plus** a minimal Express directory
 * tree *inside* an already-running container.  
 *
 * ✨ 2025-05-26 refactor: the old Create-React-App bootstrap step was deleted.
 *    Front-end assets will be generated elsewhere (e.g. Next JS, Vite, etc.),
 *    so we no longer pull 250 MB of CRA dependencies or exhaust disk space.
 *
 * NOTE: We **never** call `docker run` here – if the DB has no
 *       `container_name` for the project, we bail out and let upstream
 *       logic decide how to recover.
 */

import {
  createTask,
  updateTaskStatus,
} from '../taskUtils';                      // ← utilities live one level up
import {
  getContainerName,
  runCommand,                                // exported by utils/projectUtils.ts
} from '../projectUtils';

/**
 * Kick off the directory-scaffolding process inside an existing container.
 *
 * @param creatorId   – authenticated user that triggered the action
 * @param rootPath    – slug-safe directory name for this project
 * @param projectId   – UUID of the SolanaFlow project
 * @param projectDesc – Short README description (kept for parity)
 */
export const startCreateProjectDirectoryTask = async (
  creatorId   : string,
  rootPath    : string,
  projectId   : string,
  projectDesc = 'A Solana Anchor application'
): Promise<string> => {
  if (!projectId) throw new Error('Project ID is required');

  const taskId          = await createTask('Create Project Directory', creatorId, projectId);
  const sanitizedTaskId = taskId.trim().replace(/,$/, '');

  /* run asynchronously so the API call can return right away */
  setImmediate(async () => {
    try {
      /* ----------------------------------------------------------- *
       * 1. Re-use the container recorded in `solanaproject`.        *
       * ----------------------------------------------------------- */
      const containerName = await getContainerName(projectId);
      if (!containerName) throw new Error(`No container recorded for project ${projectId}`);

      /* ----------------------------------------------------------- *
       * 2. Anchor project root (e.g. `anchor init my-proj`)         *
       * ----------------------------------------------------------- */
      await runCommand(
        `docker exec ${containerName} bash -c "cd /usr/src && anchor init ${rootPath}"`,
        '.',
        sanitizedTaskId,
        { skipSuccessUpdate: true },
      );

      /* ----------------------------------------------------------- *
       * 3. Express skeleton                                         *
       * ----------------------------------------------------------- */
      await runCommand(
        `docker exec ${containerName} bash -c "mkdir -p /usr/src/${rootPath}/server/src"`,
        '.',
        sanitizedTaskId,
        { skipSuccessUpdate: true },
      );

      /* (Any additional file-creation & dependency-installation
         steps can stay here; they already target the right paths.) */

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
