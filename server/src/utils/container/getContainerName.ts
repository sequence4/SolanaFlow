import pool from "../../config/database";

export async function getContainerName(projectId: string): Promise<string | null> {
    const result = await pool.query(
      'SELECT "container_name" FROM solanaproject WHERE id = $1',
      [projectId]
    );
    if (!result.rows.length || !result.rows[0].container_name) {
      return null;
    }
    return result.rows[0].container_name;
  }