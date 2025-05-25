import pool from '@/config/database';
import { execSync } from 'child_process';

export interface RentedContainer {
  name: string;
  url:  string;
}

export async function rentContainerFromPool(): Promise<RentedContainer | null> {
  const { rows } = await pool.query<{ name: string; port: number }>(`
    WITH candidate AS (
      SELECT name
        FROM warm_container_pool
       WHERE busy = false
       ORDER BY last_used ASC          -- least-recently-used first
       LIMIT 1
       FOR UPDATE SKIP LOCKED
    )
    UPDATE warm_container_pool
       SET busy      = true,
           last_used = now()
     WHERE name IN (SELECT name FROM candidate)
    RETURNING name, port;
  `);

  if (rows.length === 0) return null;

  const { name, port } = rows[0];

  try {
    execSync(`docker start ${name}`, { stdio: 'ignore' });
  } catch {
    await pool.query(
      'UPDATE warm_container_pool SET busy = false WHERE name = $1',
      [name]
    );
    return null;
  }

  return {
    name,
    url: `https://${port}.ws.solanaflow.dev`,
  };
}

export async function releaseContainerToPool(name: string): Promise<void> {
  await pool.query(
    'UPDATE warm_container_pool SET busy = false, last_used = now() WHERE name = $1',
    [name]
  );
}
