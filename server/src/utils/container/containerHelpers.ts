import { execSync } from "child_process";
import { Agent, setGlobalDispatcher } from "undici";

/* Increase TCP connect timeout from Undici's default 10 s → 60 s */
setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }));

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

  /* ① Explicit FQDN → respect it. ② Otherwise use loop-back */
  const host   = process.env.PUBLIC_FQDN ?? "127.0.0.1";
  const scheme = process.env.CONTAINER_URL_SCHEME ?? "http";

  return `${scheme}://${host}:${port}`;
}

export async function isUrlAlive(
  url: string,
  retries = 10,
  delayMs = 2_000,
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { method: "HEAD" });
      if (r.ok) return true;
    } catch { /* ignore & retry */ }
    await new Promise(res => setTimeout(res, delayMs));
  }
  console.error(`URL check failed for ${url} after ${retries} attempts`);
  return false;
}

export async function folderExists(container: string, path: string): Promise<boolean> {
  try {
    execSync(`docker exec ${container} test -d ${path}`);
    return true;
  } catch {
    return false;
  }
}