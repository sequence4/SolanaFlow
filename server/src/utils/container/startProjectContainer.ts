import { execSync } from 'child_process';
import pool from 'src/config/database';
import { format } from 'node:util';

// ────────────────────────────────────────────────
// Host port that every dApp container will publish
// Change the default if 31000 is taken, or expose it via .env
const PINNED_HOST_PORT = process.env.DAPP_HOST_PORT ?? '31000';
// ────────────────────────────────────────────────

function portInUse(port: string): boolean {
  try {
    return !!execSync(`docker ps --filter publish=${port} --format '{{.ID}}'`)
             .toString().trim();
  } catch {                       // treat any error as "port free"
    return false;
  }
}

/**
 * Checks if the Docker server version supports the --pull=always flag (added in 23.0.0)
 */
function dockerSupportsPullAlways(): boolean {
  try {
    const versionStr = execSync('docker version --format "{{.Server.Version}}"', 
                      { encoding: 'utf8' }).trim();
    const versionParts = versionStr.split('.').map(Number);
    
    // Simple semver comparison for major version
    if (versionParts[0] >= 23) {
      return true;
    }
    return false;
  } catch {
    return false; // On any error, assume the flag isn't supported
  }
}

/** Returns true if we should append --pull=always to `docker run`.
 *  The flag is safe only on tag references: Docker forbids it on digests. */
function pullAlwaysAllowed(imageRef: string): boolean {
  return dockerSupportsPullAlways() && !imageRef.includes('@');
}

/**
 * Returns true when the Docker daemon is overlay2 on an XFS filesystem
 * mounted with the `pquota` option (the only case where `--storage-opt size=`
 * is accepted). Falls back to false on any error.
 */
function sizeOptSupported(): boolean {
  try {
    // 1) storage driver must be overlay2
    if (execSync('docker info --format "{{.Driver}}"', { encoding: "utf8" }).trim() !== "overlay2") {
      return false;
    }

    // 2) driver status must mention both "Backing Filesystem: xfs" and "pquota"
    const status = execSync('docker info --format "{{json .DriverStatus}}"', { encoding: "utf8" });
    return /Backing Filesystem.*xfs/i.test(status) && /pquota/i.test(status);
  } catch {
    return false;   // safest default
  }
}

/**
 * Returns true when the Docker daemon is overlay2 on an XFS filesystem
 * mounted with the `pquota` option (the only case where `--storage-opt size=`
 * is accepted). Falls back to false on any error.
 */
function isRemoteDocker(): boolean {
  const h = process.env.DOCKER_HOST ?? "";
  const remote = h.startsWith("ssh://") || h.startsWith("tcp://");
  const forced = process.env.FORCE_REMOTE_DOCKER === "1";
  /* quick trace so we see what the server really received */
  console.debug("[docker] DOCKER_HOST =", h || "<unset>",
                "| FORCE_REMOTE_DOCKER =", process.env.FORCE_REMOTE_DOCKER);
  return remote || forced;
}

/**
 * Returns free bytes left on the partition that backs /var/lib/docker.
 * Falls back to Number.MAX_SAFE_INTEGER on any failure so we never block.
 */
function getDockerFreeBytes(): number {
  try {
    const out = execSync(
      "df -B1 /var/lib/docker | tail -1 | awk '{print $4}'",
      { encoding: "utf8" }
    ).trim();
    return Number(out || 0);
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

/**
 * Ensures at least `minBytes` are available under /var/lib/docker.
 * If not, runs `docker system prune -af --volumes` once and re-checks.
 * Throws 'LOW_DOCKER_SPACE' if the space is still insufficient.
 */
function ensureDockerSpace(minBytes = 3 * 1024 * 1024 * 1024): void {
  /* Skip entirely for remote builds or when the dev forces it */
  if (isRemoteDocker()) {
    console.warn("[startProjectContainer] remote Docker detected – "
               + "disk-space probe skipped");
    return;
  }

  const free = getDockerFreeBytes();

  /* If the probe failed (MAX_SAFE_INTEGER) we treat it as "unknown" and skip. */
  if (free === Number.MAX_SAFE_INTEGER) {
    console.warn("[startProjectContainer] Unable to measure Docker disk – "
               + "skipping space guard");
    return;
  }

  if (free >= minBytes) return;

  console.warn(`[startProjectContainer] Low Docker disk (<${minBytes} bytes). `
             + "Running docker system prune -af --volumes …");
  try {
    execSync("docker system prune -af --volumes", { stdio: "inherit" });
  } catch (e) {
    console.error("[startProjectContainer] docker system prune failed:", e);
  }
  if (getDockerFreeBytes() < minBytes) {
    throw new Error("LOW_DOCKER_SPACE");
  }
}

/**
 * Starts a new Docker container for a project
 * 
 * @param projId - The project ID
 * @returns The container details including name and URL
 */
export async function startProjectContainer(projId: string): Promise<{
  containerName: string;
  containerUrl: string;
}> {
  const name  = `userproj-${projId}-${Date.now()}`.slice(0, 63);        // 64-char limit
  // Use the tag only, let --pull=always refresh it
  const image = process.env.SOLANAFLOW_BUILD_IMAGE ?? 
              'ghcr.io/sequence4/solana-toolchain:runtime-latest';
  
  const withPullAlways = pullAlwaysAllowed(image);
              
  // 📦 three isolated caches
  const vCargo       = 'solanaflow-cargo-registry';
  const vTargetBuild = 'solanaflow-cargo-target';
  const vSccache     = 'solanaflow-sccache';

  try {
    /* 1 ─ ensure image is present & host-arch-compatible */
    execSync(`docker pull --platform linux/arm64 ${image}`, { stdio: 'inherit' });

    /* 1b ─ ensure the traefik network exists on the remote host */
    try {
      execSync('docker network inspect traefik', { stdio: 'ignore' });
    } catch {
      console.warn('[startProjectContainer] creating missing "traefik" network');
      execSync('docker network create traefik --driver bridge', { stdio: 'inherit' });
    }

    /* 2 ─ run container with explicit platform, project label & random host-port */
    // NEW: make sure the host has enough free space (≥ 3 GiB)
    ensureDockerSpace();

    const runArgs: string[] = [
      'docker', 'run', 
      ...(withPullAlways ? ['--pull=always'] : []),
      '-d',
      '--platform', 'linux/arm64',
      '--name', name,
      '--label', `solanaflow.project=${projId}`,
      // attach 20 GiB quota only when overlay2 + xfs +pquota
      ...(sizeOptSupported() ? ['--storage-opt', 'size=20G'] : []),
      '-v', `${vCargo}:/root/.cargo`,
      '-v', `${vSccache}:/opt/sccache`,
      '-v', `${vTargetBuild}:/usr/src/target`,
      '-e', 'CARGO_TARGET_DIR=/usr/src/target',
      '-e', 'HOSTNAME=0.0.0.0',
      // Add APP_ID environment variable for Next.js inside the container
      '-e', `APP_ID=${projId}`,
      // Add Traefik labels for routing
      '--label=traefik.enable=true',
      // Quote the whole rule so the shell never touches the back-ticks
      `--label='traefik.http.routers.dapp-${projId}.rule=PathPrefix(\`/dapp/${projId}\`)'`,
      `--label=traefik.http.routers.dapp-${projId}.entrypoints=web,websecure`,
      `--label='traefik.http.routers.dapp-${projId}.middlewares=strip-${projId}'`,
      `--label='traefik.http.middlewares.strip-${projId}.stripprefix.prefixes=/dapp/${projId}'`,
      `--label=traefik.http.routers.dapp-${projId}.service=dapp-${projId}`,
      `--label=traefik.http.services.dapp-${projId}.loadbalancer.server.port=3000`,
      '--network', 'traefik',              // let Traefik proxy via :80/:443
      image,
      'bash',
      '-lc',
      '"exec sleep infinity"'
    ];

    console.log('[startProjectContainer] RUN CMD:\n', runArgs.join(' '));
    execSync(runArgs.join(' '), { stdio: 'inherit' });

    const host = process.env.PUBLIC_HOSTNAME ?? 'localhost';
    // Traefik serves everything over 80/443
    const containerUrl = `https://${host}/dapp/${projId}`;
    console.log(
      `[startProjectContainer] ➜  ${containerUrl}`,
    );
    return {
      containerName: name,
      containerUrl
    };
  } catch (err: any) {
    /* ---------- quarantine on failure ---------- */
    const reason = err.stderr?.toString() || err.message || 'unknown';
    console.error('[startProjectContainer] docker run failed:', reason);

    /* Attempt best-effort cleanup of half-created container */
    try { execSync(`docker rm -f ${name}`); } catch { /* ignore */ }

    /* Tag a sentinel row: port = 0  ➜ excluded from partial-unique index */
    const failed = `failed-container-${name}`;
    await pool.query(
      `INSERT INTO warm_container_pool (name, image, busy, port, last_used)
             VALUES ($1,      $2,    false, 0,    now())
         ON CONFLICT (name) DO UPDATE
                   SET image = EXCLUDED.image,
                       busy  = false,
                       port  = 0,
                       last_used = now()`,
      [failed, image]
    );

    throw new Error(`Container creation failed: ${reason}`);
  }
} 