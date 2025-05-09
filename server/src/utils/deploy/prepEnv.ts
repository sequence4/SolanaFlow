/*
import pool from "../config/database";
import {
  startProjectContainer,
  startCreateProjectDirectoryTask,
  rentContainerFromPool,
} from "./projectUtils";
import { isUrlAlive, resolveContainerUrl } from "./containerFileUtils";

export interface WorkspaceHandle {
  rootPath: string;
  containerName: string;
  containerUrl: string;
}
*/

import pool from "src/config/database";

/*
export async function prepEnv(
  projectId: string,
  userId: string
): Promise<WorkspaceHandle> {
  // ── look up project meta ─────────────────────────────────────────── 
  const result = await pool.query<{
    root_path: string;
    container_url: string | null;
  }>("SELECT root_path, container_url FROM solanaproject WHERE id = $1", [
    projectId,
  ]);


  if (result.rowCount === 0) throw new Error("Project not found");


  const { root_path: rootPath, container_url: dbUrl } = result.rows[0];


  // ── fast path: existing URL still alive ──────────────────────────── 
  if (dbUrl && (await isUrlAlive(dbUrl))) {
    return {
      rootPath,
      containerName: extractContainerName(dbUrl),
      containerUrl: dbUrl,
    };
  }


  // ── warm-pool / cold-start ───────────────────────────────────────── 
  const containerName =
    (await rentContainerFromPool()) ??
    (await startProjectContainer(projectId, userId)); // returns docker name


  const containerUrl = await resolveContainerUrl(containerName);


  // Save for next time
  await pool.query(
    "UPDATE solanaproject SET container_url=$1, container_name=$2 WHERE id=$3",
    [containerUrl, containerName, projectId]
  );


  // ── guarantee project folder exists in container ─────────────────── 
  if (!(await folderExists(containerName, `/usr/src/${rootPath}`))) {
    await startCreateProjectDirectoryTask(userId, rootPath, projectId);
    // You can await task completion here if strict consistency is needed
  }


  return { rootPath, containerName, containerUrl };
}

function extractContainerName(url: string) {
  // You store container_url as "http://<name>:8765"
  return new URL(url).hostname;
}


async function folderExists(container: string, path: string) {
  // cheap check; returns 0 on success
  const { execSync } = await import("child_process");
  try {
    execSync(`docker exec ${container} test -d ${path}`);
    return true;
  } catch {
    return false;
  }
}

*/

