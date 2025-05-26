import pool from 'src/config/database';
import {
  startProjectContainer,
} from '../projectUtils';
import { startCreateProjectDirectoryTask } from '../project/createProject';
import {
  rentContainerFromPool,
  releaseContainerToPool,
} from '../container/rentContainerFromPool';
import {
  resolveContainerUrl,
  isUrlAlive,
  folderExists,
} from '../container/containerHelpers';
import { WorkspaceHandle } from '../container/interfaces';

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function prepEnv(
  projectId: string,
  userId: string,
): Promise<WorkspaceHandle> {
  const res = await pool.query<{
    root_path: string;
    container_url: string | null;
    container_name: string | null;
  }>(
    `SELECT root_path, container_url, container_name
       FROM solanaproject
      WHERE id = $1`,
    [projectId],
  );
  if (res.rowCount === 0) throw new Error('Project not found');

  const { root_path: rootPath } = res.rows[0];
  let { container_url: dbUrl, container_name: dbName } = res.rows[0];

  // ignore broken sentinel names from earlier failures
  if (dbName?.startsWith('failed-container-')) {
    dbName = null;
    dbUrl = null;
  }

  // fast path –- already linked to a healthy container
  if (dbName && dbUrl && (await isUrlAlive(dbUrl))) {
    return { rootPath, containerName: dbName, containerUrl: dbUrl };
  }

  // try to grab a warm container from the pool
  const rented = await rentContainerFromPool();

  let containerName: string;
  let containerUrl: string;

  if (rented) {
    // warm-start: use the container as-is
    containerName = rented.name;
    containerUrl = rented.url;
  } else {
    // cold-start fallback: spin up a brand-new workspace
    containerName = await startProjectContainer(projectId);
    containerUrl = await resolveContainerUrl(containerName);
  }

  try {
    // persist assignment
    await pool.query(
      `UPDATE solanaproject
          SET container_url  = $1,
              container_name = $2
        WHERE id = $3`,
      [containerUrl, containerName, projectId],
    );

    const projectDir = `/usr/src/${rootPath}`;
    let dirReady = false;

    // check up to 5× for the project directory before kicking off creation task
    for (let attempts = 0; attempts < 5 && !dirReady; attempts++) {
      try {
        dirReady = await folderExists(containerName, projectDir);
      } catch {
        await sleep(2000);
      }
    }

    if (!dirReady) {
      await startCreateProjectDirectoryTask(userId, rootPath, projectId);
    }

    return { rootPath, containerName, containerUrl };
  } catch (err) {
    if (rented) await releaseContainerToPool(rented.name);
    throw err;
  }
}
