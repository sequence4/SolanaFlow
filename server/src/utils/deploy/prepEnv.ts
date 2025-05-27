import pool from 'src/config/database';
import {
  startProjectContainer,
} from '../projectUtils';
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
import { execSync } from 'child_process';

export type { WorkspaceHandle } from '../container/interfaces';

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
    try {
      containerName = await startProjectContainer(projectId);
      if (!containerName) {
        throw new Error('No warm containers available and cold-start disabled');
      }
      containerUrl = await resolveContainerUrl(containerName);
    } catch (err: any) {
      console.error('[prepEnv] Cold-start failed:', err.message);
      throw new Error(`Container creation failed: ${err.message}`);
    }
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
      // ensure the root directory exists … nothing heavier than this
      await pool.query('SELECT container_name FROM solanaproject WHERE id = $1', [projectId])
        .then(({ rows }) => {
          const name = rows[0]?.container_name;
          if (!name) throw new Error(`No container for project ${projectId}`);
          execSync(`docker exec ${name} bash -c "mkdir -p /usr/src/${rootPath}"`);
        });
    }

    // ---- bootstrap template if Cargo.toml is still missing ----------------
    try {
      const hasCargo = await folderExists(containerName, `${projectDir}/Cargo.toml`);
      if (!hasCargo) {
        console.log(`[prepEnv] Bootstrapping template into ${projectDir}`);
        // copy baked Anchor template (added at /usr/src/anchor-template by Dockerfile)
        execSync(
          `docker exec ${containerName} bash -c ` +
          `"cp -r /usr/src/anchor-template/* '${projectDir}' && ` +
          `chown -R 1000:1000 '${projectDir}'"`,  // 1000:1000 == node user in image
        );
      }
    } catch (copyErr) {
      console.error('[prepEnv] template copy failed:', copyErr);
      throw copyErr;
    }

    return { rootPath, containerName, containerUrl };
  } catch (err) {
    if (rented) await releaseContainerToPool(rented.name);
    throw err;
  }
}
