import { execSync } from "child_process";

export async function resolveContainerUrl(name: string): Promise<string> {
  if (name.startsWith('failed-container-')) {
    throw new Error('Container creation failed – see previous logs.');
  }

  try {
    execSync(`docker start ${name}`, { stdio: "ignore" });
  } catch {
  }

  const out = execSync(`docker port ${name} 3000/tcp`, { encoding: "utf8" }).trim();
  if (!out) throw new Error(`port not found for ${name}`);
  const m = out.match(/:(\d+)$/);
  if (!m) throw new Error(`port parse fail for ${name}`);

  const port   = m[1]; 
  const host   = process.env.PUBLIC_FQDN ?? `${port}.ws.solanaflow.io`;
  const scheme = process.env.CONTAINER_URL_SCHEME ?? "https";

  return process.env.PUBLIC_FQDN
    ? `${scheme}://${host}:${port}`
    : `${scheme}://${host}`;
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