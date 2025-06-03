import pool from "../../config/database";

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