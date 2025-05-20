import { execSync } from "child_process";

export async function resolveContainerUrl(name: string): Promise<string> {
  try {
    // ensure container is running, or `docker port` prints nothing
    execSync(`docker start ${name}`, { stdio: "ignore" });
  } catch {
    /* already running or start failed – ignore */
  }

  const out = execSync(`docker port ${name} 3000/tcp`, { encoding: "utf8" }).trim();
  if (!out) throw new Error(`port not found for ${name}`);
  const m = out.match(/:(\d+)$/);
  if (!m) throw new Error(`port parse fail for ${name}`);
  const host = process.env.PUBLIC_FQDN ?? `${m[1]}.ws.solanaflow.dev`;
  return `https://${host}`;
}

export async function isUrlAlive(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error(`URL check failed for ${url}:`, error);
    return false;
  }
}

export async function folderExists(container: string, path: string): Promise<boolean> {
  try {
    execSync(`docker exec ${container} test -d ${path}`);
    return true;
  } catch {
    return false;
  }
}