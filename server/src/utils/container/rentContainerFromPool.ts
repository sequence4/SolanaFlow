import { execSync } from 'child_process';
import pool from 'src/config/database';
import { resolveContainerUrl } from './containerHelpers';

interface RentedContainer {
  name: string;
  url: string;
  port: number;
}

/**
 * Adds Traefik labels to an existing container
 * @param container - Container name
 * @param projectId - Project ID to use for routing
 */
function addTraefikLabels(container: string, projectId: string): void {
  try {
    console.log(`[rentContainerFromPool] Adding Traefik labels to container ${container} for project ${projectId}`);
    
    // Update container with labels without restarting it
    execSync(
      `docker container update \
        --env-add APP_ID=${projectId} \
        --label-add traefik.enable=true \
        --label-add 'traefik.http.routers.dapp-${projectId}.rule=PathPrefix(\`/dapp/${projectId}\`)' \
        --label-add traefik.http.routers.dapp-${projectId}.entrypoints=web,websecure \
        --label-add traefik.http.routers.dapp-${projectId}.middlewares=strip-${projectId} \
        --label-add 'traefik.http.middlewares.strip-${projectId}.stripprefix.prefixes=/dapp/${projectId}' \
        --label-add traefik.http.routers.dapp-${projectId}.service=dapp-${projectId} \
        --label-add traefik.http.services.dapp-${projectId}.loadbalancer.server.port=3000 \
        ${container}`,
      { stdio: 'ignore' }
    );
  } catch (err) {
    console.error(`[rentContainerFromPool] Failed to add Traefik labels to container ${container}:`, err);
    // Continue despite errors - the container is still usable even without labels
  }
}

export async function rentContainerFromPool(): Promise<RentedContainer | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get an idle donor that has no published port (port = 0, means "clean")
    const result = await client.query(
      `UPDATE warm_container_pool
          SET busy = true,
              last_used = now()
        WHERE name = (
              SELECT name
                FROM warm_container_pool
               WHERE busy = false
                 AND port  = 0
            ORDER BY last_used ASC          -- oldest-used first (LRU)
               LIMIT 1
              )
    RETURNING name`
    );

    if (result.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const { name } = result.rows[0];

    // Check if container actually exists and is healthy
    try {
      execSync(`docker inspect ${name}`, { stdio: 'ignore' });
    } catch (err) {
      // Container doesn't exist or is unhealthy, mark it as not busy
      await client.query(
        'UPDATE warm_container_pool SET busy = false WHERE name = $1',
        [name]
      );
      await client.query('COMMIT');
      return null;
    }

    // Start the container if it exists but is stopped
    try {
      execSync(`docker start ${name}`, { stdio: 'ignore' });
    } catch (err) {
      console.error(`Failed to start container ${name}:`, err);
      await client.query(
        'UPDATE warm_container_pool SET busy = false WHERE name = $1',
        [name]
      );
      await client.query('COMMIT');
      return null;
    }

    await client.query('COMMIT');

    const url = await resolveContainerUrl(name);
    
    // Extract project ID from container name (format: userproj-{projId}-{timestamp})
    const projectIdMatch = name.match(/^userproj-([^-]+)-/);
    const projectId = projectIdMatch ? projectIdMatch[1] : 'default';
    
    // Add Traefik labels to the container
    addTraefikLabels(name, projectId);

    // keep the authoritative URL coming from resolveContainerUrl()
    const port = Number(url.split(':').pop());
    return { name, url, port };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function releaseContainerToPool(name: string): Promise<void> {
  // if the container row was wiped by prune, ignore the update
  try {
    await pool.query(
      `UPDATE warm_container_pool
          SET busy = false,
              port = 0,
              last_used = now()
        WHERE name = $1`,
      [name]
    );
  } catch {/* ignore */}
}
