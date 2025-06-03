import pool from "../../config/database";
import { APP_CONFIG } from "../../config/appConfig";
import { exec as _exec } from "child_process";
import util from "util";
const exec = util.promisify(_exec);

/**
 * Queue a workspace container for later removal.
 * No table-drops, only one INSERT per container.
 */
export async function markContainerForCleanup(
  projectId: string,
  containerName: string
): Promise<void> {
  await pool.query(
    `INSERT INTO cleanup_queue (container_name, project_id, queued_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (container_name) DO NOTHING`,
    [containerName, projectId]
  );
}

/** Delete containers queued earlier than `olderThan` and remove their DB row. */
export async function flushOldContainers(staleMs: number): Promise<void> {
  // 1) fetch, but DON'T delete yet
  const { rows } = await pool.query(
    `SELECT container_name
       FROM cleanup_queue
      WHERE queued_at < NOW() - ($1 * INTERVAL '1 millisecond')`,
    [staleMs]
  );

  for (const { container_name } of rows) {
    try {
      await exec(`docker rm -f ${container_name}`);
      await pool.query(`DELETE FROM cleanup_queue WHERE container_name = $1`, [container_name]);
    } catch (e) {
      console.warn('[cleanup] docker rm failed, will retry:', container_name, e);
    }
  }
} 