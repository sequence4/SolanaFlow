import pool from '@/config/database';
import { execSync } from 'child_process';

export interface RentedContainer {
  name: string;
  url:  string;
}


export async function rentContainerFromPool(): Promise<RentedContainer | null> {
  const { rows } = await pool.query<{ name: string; port: number }>(`
    UPDATE warm_container_pool
       SET busy       = true,
           last_used  = now()
     WHERE name IN (
         SELECT name
           FROM warm_container_pool
          WHERE busy = false
          LIMIT 1
          FOR UPDATE SKIP LOCKED
     )
  RETURNING name, port;
  `);

  if (!rows.length) return null;

  const { name, port } = rows[0];

  try {
    execSync(`docker start ${name}`, { stdio: 'ignore' });
  } catch {
  }

  return {
    name,
    url: `https://${port}.ws.solanaflow.dev`,
  };
}

export async function releaseContainerToPool(name: string): Promise<void> {
  await pool.query('UPDATE warm_container_pool SET busy = false WHERE name = $1', [name]);
}
