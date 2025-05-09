import pool from "src/config/database";
import { execSync } from "child_process";
import { resolveContainerUrl } from "./resolveContainerUrl";
import { RentedContainer } from "./interfaces";

export async function rentContainerFromPool(): Promise<RentedContainer | null> {
  const res = await pool.query<{
    name: string;
  }>(
    `
    UPDATE warm_container_pool
       SET busy      = true,
           last_used = now()
     WHERE name IN (
       SELECT name
         FROM warm_container_pool
        WHERE busy = false
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
    RETURNING name
    `
  );

  if (res.rowCount === 0) return null;

  const { name } = res.rows[0];

  try {
    const status = execSync(`docker inspect -f '{{.State.Running}}' ${name}`)
      .toString()
      .trim();
    if (status !== "true") {
      execSync(`docker start ${name}`);
    }
  } catch (err) {
    console.error(`[warm-pool] failed to (re)start ${name}:`, err);
  }

  const url = await resolveContainerUrl(name);

  return { name, url };
}

export async function releaseContainerToPool(name: string) {
  await pool.query(
    `UPDATE warm_container_pool SET busy = false WHERE name = $1`,
    [name]
  );
}
