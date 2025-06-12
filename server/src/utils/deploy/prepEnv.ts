import pool from 'src/config/database';
import { v4 as uuidv4 } from 'uuid';
import {
  runCommand,
} from '../projectUtils';
import {
  rentContainerFromPool,
  releaseContainerToPool,
  startProjectContainer
} from '../container';
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
    /* Rebuild URL so it uses 127.0.0.1, not the public hostname */
    containerUrl  = await resolveContainerUrl(rented.name);
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

    // ─── bootstrap workspace if Cargo.toml is missing ──────────────────────
    const hasCargo = await folderExists(containerName, `${projectDir}/Cargo.toml`);
    if (!hasCargo) {
      console.log(`[prepEnv] Bootstrapping workspace in ${projectDir}`);

      let copied = false;
      try {
        /**
         * We copy the baked Anchor template so users don't wait for `anchor init`,
         * but we exclude the giant `target/` build cache and `node_modules/`.
         * Those directories regenerate on the first build/npm install, keeping
         * workspace containers < 500 MB and avoiding "No space left on device".
         */
        execSync(
          // tar is available in every Debian/Ubuntu-based image; we can still
          // exclude the big dirs just like rsync did.
          `docker exec ${containerName} bash -c "` +
          `cd /usr/src/anchor-template && ` +
          `tar -cf - --exclude='target' --exclude='node_modules' --exclude='.git' . | ` +
          `tar -xf - -C '${projectDir}' && ` +
          `chown -R 1000:1000 '${projectDir}'"`,
          { stdio: 'inherit' }
        );
        copied = true;
      } catch {
        console.warn('[prepEnv] No prebaked template found – falling back to anchor init');
      }

      if (!copied) {
        /* Universal path: generate a fresh Anchor workspace */
        execSync(
          `docker exec ${containerName} bash -c "` +
          `anchor init '${projectDir}' --no-git --force && ` +  // TS flag removed in Anchor 0.31
          `chown -R 1000:1000 '${projectDir}'"`,
          { stdio: 'inherit' }
        );
      }
    }

    // ─── quick probes so handleGenerateCode can trust the env ───
    try {
      // temporary task ID for health probes (won't pollute task system)
      const probeTaskId = uuidv4();
      
      // 1) show container status
      const psOutput = await runCommand(
        `docker ps --filter "name=${containerName}" --format "{{.Names}}|{{.Status}}"`,
        '.',
        probeTaskId,
        { skipSuccessUpdate: true }
      );
      console.log(`[ENV] container ${containerName} status:`, psOutput.trim());

      // 2) check solana / anchor versions inside
      const solanaVer = await runCommand(
        `docker exec ${containerName} solana --version`,
        '.',
        probeTaskId,
        { skipSuccessUpdate: true }
      );
      const anchorVer = await runCommand(
        `docker exec ${containerName} anchor --version`,
        '.',
        probeTaskId,
        { skipSuccessUpdate: true }
      );
      console.log('[ENV] solana:', solanaVer.trim(), '| anchor:', anchorVer.trim());

      // 3) quick rust+cargo sanity
      const rustcVer = await runCommand(
        `docker exec ${containerName} rustc --version`,
        '.',
        probeTaskId,
        { skipSuccessUpdate: true }
      );
      const cargoVer = await runCommand(
        `docker exec ${containerName} cargo --version`,
        '.',
        probeTaskId,
        { skipSuccessUpdate: true }
      );
      console.log('[ENV] rustc:', rustcVer.trim(), '| cargo:', cargoVer.trim());
    } catch (probeErr) {
      console.warn('[ENV] health-probe failed:', probeErr);
    }
    // ────────────────────────────────────────────────────────────

    return { rootPath, containerName, containerUrl };
  } catch (err) {
    if (rented) await releaseContainerToPool(rented.name);
    throw err;
  }
}
