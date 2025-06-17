import { execSync } from 'child_process';
import pool from 'src/config/database';
import { resolveContainerUrl } from './containerHelpers';

interface RentedContainer {
  name: string;
  url: string;
  port: number;
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
    
    // Persist the random host-port (needed so the same donor is not re-selected)
    const hostPort = Number(url.split(':').pop());
    if (hostPort === 0) {
      throw new Error(
        `[rent] container ${name} started without a published 3000/tcp port`
      );
    }
    if (!Number.isNaN(hostPort)) {
      await pool.query(
        'UPDATE warm_container_pool SET port = $2 WHERE name = $1',
        [name, hostPort]
      );
    }
    
    return { name, url, port: hostPort };
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
