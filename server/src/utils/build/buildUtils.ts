import pool from "src/config/database";
import { getBuildArtifactTask } from "../projectUtils";

export async function needsBuild(projectId: string): Promise<boolean> {
  const artifact = await getBuildArtifactTask(projectId);
  // quick checksum against latest code hash (implement as you like)
  return !artifact?.base64So || artifact.base64So !== (await currentCodeHash(projectId));
}

export async function currentCodeHash(projectId: string): Promise<string> {
  // tiny helper that SHA-256's lib.rs + instruction/*.rs inside container
  // implement with `docker exec sh -c 'sha256sum …'` or Node hashing
  return "dummy-hash"; // placeholder
}

export async function fetchProjectFlags(projectId: string) {
  const r = await pool.query<{
    details: any;
  }>("SELECT details FROM solanaproject WHERE id = $1", [projectId]);
  const details =
    typeof r.rows[0].details === "string"
      ? JSON.parse(r.rows[0].details)
      : r.rows[0].details || {};
  return {
    isLite: !!details.isLite,
  };
}

export async function getTxSigFromTask(taskId: string): Promise<string | null> {
  const r = await pool.query<{ result: string }>(
    "SELECT result FROM task WHERE id=$1",
    [taskId]
  );
  return r.rows[0]?.result || null;
}