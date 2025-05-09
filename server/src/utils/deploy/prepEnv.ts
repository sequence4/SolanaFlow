import pool from "src/config/database";
import {
  startProjectContainer,
  startCreateProjectDirectoryTask,
} from "../projectUtils";
import {
  rentContainerFromPool,
} from "../container/rentContainerFromPool";
import { resolveContainerUrl } from "../container/resolveContainerUrl";
import {
  isUrlAlive,
  extractContainerName,
  folderExists,
} from "../container/containerHelpers";
import { WorkspaceHandle } from "../container/interfaces";

export async function prepEnv(
  projectId: string,
  userId: string
): Promise<WorkspaceHandle> {
  const res = await pool.query<{
    root_path: string;
    container_url: string | null;
  }>(
    `SELECT root_path, container_url
       FROM SolanaProject
      WHERE id = $1`,
    [projectId],
  );

  if (res.rowCount === 0) throw new Error("Project not found");
  const { root_path: rootPath, container_url: dbUrl } = res.rows[0];

  if (dbUrl && (await isUrlAlive(dbUrl))) {
    return {
      rootPath,
      containerName: extractContainerName(dbUrl),
      containerUrl: dbUrl,
    };
  }

  const rented = await rentContainerFromPool();
  const containerName = rented?.name ?? (await startProjectContainer(projectId, userId));
  const containerUrl = rented?.url ?? (await resolveContainerUrl(containerName));

  await pool.query(
    `UPDATE SolanaProject
        SET container_url = $1,
            container_name = $2
      WHERE id = $3`,
    [containerUrl, containerName, projectId],
  );

  const pathInside = `/workspace/${rootPath}`;
  if (!(await folderExists(containerName, pathInside))) {
    await startCreateProjectDirectoryTask(userId, rootPath, projectId);
  }

  return { rootPath, containerName, containerUrl };
}
