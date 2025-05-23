import pool from 'src/config/database'
import { startProjectContainer, startCreateProjectDirectoryTask } from '../projectUtils'
import { rentContainerFromPool, releaseContainerToPool } from '../container/rentContainerFromPool'
import { resolveContainerUrl } from '../container/containerHelpers'
import { isUrlAlive, folderExists } from '../container/containerHelpers'
import { WorkspaceHandle } from '../container/interfaces'

export async function prepEnv(projectId: string, userId: string): Promise<WorkspaceHandle> {
  const res = await pool.query<{
    root_path: string;
    container_url: string | null;
    container_name: string | null;
  }>(
    'SELECT root_path, container_url, container_name FROM solanaproject WHERE id = $1',
    [projectId]
  )
  if (res.rowCount === 0) throw new Error('Project not found')
  let { root_path: rootPath,
        container_url: dbUrl,
        container_name: dbContainerName } = res.rows[0]

  if (dbContainerName?.startsWith('failed-container-')) {
    dbContainerName = null;
    dbUrl           = null;
  }

  if (dbUrl && dbContainerName && (await isUrlAlive(dbUrl))) {
    return { rootPath, containerName: dbContainerName, containerUrl: dbUrl }
  }

  const rented = await rentContainerFromPool();
  let containerName: string | undefined;
  try {
    containerName = rented?.name
      ?? (await startProjectContainer(projectId));

    const containerUrl =
      rented?.url ?? (await resolveContainerUrl(containerName));

    await pool.query(
      'UPDATE solanaproject SET container_url = $1, container_name = $2 WHERE id = $3',
      [containerUrl, containerName, projectId]
    );

    const projectDir = `/usr/src/${rootPath}`;
    if (!(await folderExists(containerName, projectDir))) {
      await startCreateProjectDirectoryTask(userId, rootPath, projectId);
    }

    return { rootPath, containerName, containerUrl };

  } catch (err) {
    if (rented?.name) {
      await releaseContainerToPool(rented.name);
    }
    throw err;
  }
}
