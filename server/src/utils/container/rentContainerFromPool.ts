import { execSync } from 'child_process';
import pool from '../../config/database';
import { resolveContainerUrl } from './containerHelpers';

interface RentedContainer {
  name: string;
  url: string;
}

export async function rentContainerFromPool(): Promise<RentedContainer | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get a free container from the pool
    const result = await client.query(
      `UPDATE warm_container_pool
         SET busy = true,
             last_used = now()
        WHERE name = (
          SELECT name
            FROM warm_container_pool
           WHERE busy = false
           ORDER BY last_used DESC
           LIMIT 1
        )
      RETURNING name`,
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
    return { name, url };
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
      'UPDATE warm_container_pool SET busy = false WHERE name = $1',
      [name]
    );
  } catch {/* ignore */}
}
