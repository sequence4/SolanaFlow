import { execSync } from "child_process";
import { Agent, setGlobalDispatcher } from "undici";

/* Increase TCP connect timeout from Undici's default 10 s → 60 s */
setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }));

export async function resolveContainerUrl(name: string): Promise<string> {
  if (name.startsWith('failed-container-')) {
    throw new Error('Container creation failed – see previous logs.');
  }

  // ① Make sure the container is running (ignore "already running" errors)
  try { execSync(`docker start ${name}`, { stdio: 'ignore' }); } catch {/* nop */}

  /* -------------------------------------------------------------
   * ② Retry `docker port … 3000/tcp` for up to 60 s (60 × 1000 ms)
   *    Docker sometimes needs a short moment to register the random
   *    host-port after `docker run -P`.  A tight loop eliminates the
   *    "No public port '3000/tcp' published" race we observed.
   * ------------------------------------------------------------ */
  let mapping = '';
  const MAX_WAIT_MS   = 60_000;      // wait up to 60 s
  const POLL_INTERVAL = 1_000;       // check every second
  const retries       = Math.ceil(MAX_WAIT_MS / POLL_INTERVAL);

  for (let i = 0; i < retries; i++) {
    try {
      mapping = execSync(`docker port ${name} 3000/tcp`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {/* container might still be booting */}
    if (!mapping.trim()) await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
  if (!mapping.trim()) {
    throw new Error(`port 3000/tcp not published for ${name} after ${MAX_WAIT_MS/1000} s`);
  }

  //console.log(`[resolveContainerUrl] ${name} → ${mapping.trim()}`);

  // Parse "…:hostPort"
  const m = mapping.match(/:(\d+)\s*$/);
  if (!m) throw new Error(`cannot parse docker port output: ${mapping}`);
  const port = m[1];

  /* ---------- choose public hostname ---------- */
  let host = process.env.PUBLIC_FQDN?.trim();
  if (!host) {
    try { host = execSync(
      "curl -s --max-time 2 http://169.254.169.254/latest/meta-data/public-hostname"
    ).toString().trim(); } catch {/* ignore */}
  }
  if (!host) {
    host = execSync("curl -s ifconfig.me").toString().trim();
  }
  if (!host) throw new Error(
    "Cannot resolve PUBLIC_FQDN and could not auto-detect EC2 hostname."
  );

  const scheme = process.env.CONTAINER_URL_SCHEME ?? 'http';
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