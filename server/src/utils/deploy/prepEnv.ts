import { execSync } from 'child_process';
import pool from "src/config/database";
import {
  startProjectContainer,
  startCreateProjectDirectoryTask,
} from "../projectUtils";
import { rentContainerFromPool } from "../container/rentContainerFromPool";
import { resolveContainerUrl } from "../container/resolveContainerUrl";
import { WorkspaceHandle } from "../container/interfaces";
import { isUrlAlive, extractContainerName, folderExists } from "../container/containerHelpers";

export async function prepEnv(
  projectId: string,
  userId: string
): Promise<WorkspaceHandle> {
  const result = await pool.query<{
    root_path: string;
    container_url: string | null;
  }>("SELECT root_path, container_url FROM solanaproject WHERE id = $1", [
    projectId,
  ]);

  if (result.rowCount === 0) throw new Error("Project not found");

  const { root_path: rootPath, container_url: dbUrl } = result.rows[0];

  if (dbUrl && (await isUrlAlive(dbUrl))) {
    return {
      rootPath,
      containerName: extractContainerName(dbUrl),
      containerUrl: dbUrl,
    };
  }

  const containerName = await startProjectContainer(projectId, userId);

  const containerUrl = await resolveContainerUrl(containerName);

  await pool.query(
    "UPDATE solanaproject SET container_url=$1, container_name=$2 WHERE id=$3",
    [containerUrl, containerName, projectId]
  );

  if (!(await folderExists(containerName, `/usr/src/${rootPath}`))) {
    await startCreateProjectDirectoryTask(userId, rootPath, projectId);
  }

  return { rootPath, containerName, containerUrl };
}

