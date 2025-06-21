import { execSync } from 'child_process';
import pool from 'src/config/database';
import { format } from 'node:util';
import os from 'os';

/* ───────── timing helper ────────
 * If you only need to *see* the output, use inherit=true.
 * If you also need to *capture* the output (inspect / port),
 * call with inherit = false (default) so execSync returns a Buffer. */
function timed(
  cmd: string,
  label: string = cmd.split(' ')[1],
  inherit: boolean = true,          // <-- default keeps logs on screen
): Buffer {
  console.time(`[${label}]`);
  const out = inherit
    ? (execSync(cmd, { stdio: 'inherit' }), Buffer.from('')) // nothing to return
    :  execSync(cmd);                                        // capture stdout
  console.timeEnd(`[${label}]`);
  return out;
}

// ─── container ports ─────────────────────────────────────────
const INTERNAL_PORT = 3000;          // inside container
const MIN_PORT = 31000, MAX_PORT = 32767;

function pickFreePort(): number {
  for (let p = MIN_PORT; p <= MAX_PORT; p++) {
    try {
      if (!execSync(`docker ps --filter publish=${p} --format '{{.ID}}'`)
            .toString().trim()) return p;          // free
    } catch { /* ignore, keep scanning */ }
  }
  throw new Error('NO_FREE_PORT');
}

function getDockerHostIP(): string {
  const dh = process.env.DOCKER_HOST;
  if (!dh) return 'localhost';
  try {
    const u = new URL(dh);
    return u.hostname || 'localhost';
  } catch {
    return 'localhost';
  }
}

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
  const forced = !!process.env.DOCKER_HOST && process.env.FORCE_REMOTE_DOCKER === "1";
  /* quick trace so we see what the server really received */
  console.debug("[docker] DOCKER_HOST =", h || "<unset>",
                "| FORCE_REMOTE_DOCKER =", process.env.FORCE_REMOTE_DOCKER);
  return remote || forced;
}

/**
 * Returns the Docker daemon's root directory path.
 * Falls back to '/var/lib/docker' if unable to determine.
 */
function getDockerRoot(): string {
  try {
    return execSync(
      'docker info --format "{{.DockerRootDir}}"',
      { encoding: 'utf8' }
    ).trim() || '/var/lib/docker';
  } catch { 
    return '/var/lib/docker'; 
  }
}

/**
 * Returns free bytes left on the partition that backs /var/lib/docker.
 * Falls back to Number.MAX_SAFE_INTEGER on any failure so we never block.
 */
function getDockerFreeBytes(): number {
  try {
    const rootDir = getDockerRoot();
    // Check if rootDir exists before running df
    if (process.platform !== 'linux' ||
        !execSync(`test -d "${rootDir}" && echo "exists"`, { encoding: "utf8" }).includes("exists")) {
      console.warn(`[getDockerFreeBytes] Docker root '${rootDir}' not found, skipping probe`);
      return Number.MAX_SAFE_INTEGER;  // Skip probe if rootDir doesn't exist
    }
    
    const out = execSync(
      `df -B1 ${rootDir} | tail -1 | awk '{print $4}'`,
      { encoding: "utf8" }
    ).trim();
    return Number(out || 0);
  } catch (e) {
    console.warn("[getDockerFreeBytes] probe failed:", e);
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
 * Resolves the container URL using the appropriate host and port
 */
export function resolveContainerUrl(port: string) {
  const fqdn = process.env.PUBLIC_FQDN;          // e.g. demo.solanaflow.xyz
  if (fqdn) return `http://${fqdn}:${port}`;
  // fall back to EC2 public hostname if set through env
  const host = process.env.PUBLIC_HOSTNAME ?? process.env.EC2_PUBLIC_IP;
  return `http://${host ?? 'localhost'}:${port}`;
}

/**
 * Starts a new Docker container for a project
 * 
 * @param projId - The project ID
 * @param devMode - Whether to run in development mode with hot-reload
 * @returns The container details including name and URL
 */
export async function startProjectContainer(
  projId: string,
  devMode = false,
): Promise<{
  containerName: string;
  containerUrl: string;
}> {
  const name  = `userproj-${projId}-${Date.now()}`.slice(0, 63);        // 64-char limit
  // Use the tag only, let --pull=always refresh it
  const image = process.env.SOLANAFLOW_BUILD_IMAGE ??
              'ghcr.io/sequence4/solana-toolchain:runtime-latest';

  /** Toggle: `SF_DEV_SERVER=1` ⇒ start `next dev` instead of standalone build */
  const useDevServer = devMode || process.env.SF_DEV_SERVER === '1';
  
  const withPullAlways = pullAlwaysAllowed(image);
              
  // ── pick architecture: env override > host default
  const hostArch = execSync('docker info --format "{{.Architecture}}"')
                  .toString().trim();                       // "x86_64" | "aarch64"

  const targetPlatform =
    process.env.SF_DOCKER_PLATFORM            // explicit override
    ?? (hostArch === 'x86_64' ? 'linux/amd64' // EC2/Intel boxes
                              : 'linux/arm64'); // Apple Silicon, Graviton, …
  
  // 📦 three isolated caches
  const vCargo       = 'solanaflow-cargo-registry';
  const vTargetBuild = 'solanaflow-cargo-target';
  const vSccache     = 'solanaflow-sccache';

  try {
    process.env.DOCKER_CLI_DEBUG = process.env.DOCKER_CLI_DEBUG ?? '1'; // show HTTP calls
    
    // find a free high port *once* for this container
    const hostPort = pickFreePort();
    
    /* 1 ─ ensure image is present & host-arch-compatible (force x86_64) */
    timed(`docker pull ${image}`, 'pull');

    // ── pin to immutable digest and then re-tag it so `docker run` will work
    let imageRef = image;
    try {
      let digest = '';
      try {
        const buf = timed(
          `docker inspect -f "{{index .RepoDigests 0}}" ${image}`,
          'inspect',
          /* inherit? */ false,          // capture instead of inherit
        );
        digest = buf ? buf.toString().trim() : '';
        if (digest) {
          console.log('[startProjectContainer] pulled digest:', digest);
          execSync(`docker tag ${digest} ${image}`, { stdio: 'inherit' });
          imageRef = image;          // pinned
        }
      } catch (e) {
        console.warn('[startProjectContainer] no digest found – using tag only');
        imageRef = image;            // safe fallback
      }
    } catch (e) {
      console.warn("[startProjectContainer] digest tagging failed; using tag:", e);
      imageRef = image;
    }

    /* 1b ─ ensure the traefik network exists on the remote host */
    try {
      execSync('docker network inspect traefik', { stdio: 'ignore' });
    } catch {
      console.warn('[startProjectContainer] creating missing "traefik" network');
      timed('docker network create traefik --driver bridge', 'net-create');
    }

    /* 2 ─ run container with explicit platform, project label & random host-port */
    // NEW: make sure the host has enough free space (≥ 3 GiB)
    ensureDockerSpace();
    
    const runArgs: string[] = [
      'docker', 'run',
      ...(withPullAlways ? ['--pull=always'] : []),     // refresh tag (Docker ≥ 23)
      '-d',                                            // detached – let pipeline continue
      '--platform', targetPlatform,                    // dynamic arch selection
      '--name', name,
      '--label', `solanaflow.project=${projId}`,
      '--restart', 'unless-stopped',
      ...(sizeOptSupported() ? ['--storage-opt', 'size=20G'] : []),  // guard FS quota
      '-v', `${vCargo}:/root/.cargo`,
      '-v', `${vSccache}:/opt/sccache`,
      '-v', `${vTargetBuild}:/usr/src/target`,
      '-e', 'CARGO_TARGET_DIR=/usr/src/target',
      '-e', 'HOSTNAME=0.0.0.0',
      // keep the two env-vars, but **drop** the --memory flags —
      // anchor build needs >4 GiB during LTO
      '-e', 'CARGO_BUILD_JOBS=1',
      '-e', 'RUSTC_WRAPPER=sccache',
      '-e', `APP_ID=${projId}`,
      '-e', `APP_BASE_PATH=/dapp/${projId}`,
      '-e', 'RUSTFLAGS=-Ccodegen-units=1 -Clinker-plugin-lto -Clto=thin -Cpanic=abort -Copt-level=z',
      '--label=traefik.enable=true',
      `--label='traefik.http.routers.dapp-${projId}.rule=PathPrefix(\`/dapp/${projId}\`)'`,
      `--label=traefik.http.routers.dapp-${projId}.entrypoints=web,websecure`,
      `--label='traefik.http.routers.dapp-${projId}.middlewares=strip-${projId}'`,
      `--label='traefik.http.middlewares.strip-${projId}.stripprefix.prefixes=/dapp/${projId}'`,
      `--label=traefik.http.routers.dapp-${projId}.service=dapp-${projId}`,
      `--label=traefik.http.services.dapp-${projId}.loadbalancer.server.port=${INTERNAL_PORT}`,
      `--label=traefik.http.services.dapp-${projId}.loadbalancer.healthcheck.timeout=30s`,
      // pin to one SG-approved port so the UI link is always stable
      '-p', `${hostPort}:${INTERNAL_PORT}`,
      '-v', `${process.env.ROOT_FOLDER}/${projId}/web:/usr/share/solanaflow/web`,
      imageRef,
      ...(useDevServer
        ? [
            'bash', '-lc',
            `"cd /usr/share/solanaflow/web && yarn install --frozen-lockfile && npx next dev -H 0.0.0.0 -p 3000"`
          ]
        : [
            'bash', '-lc',
            `"node /usr/share/solanaflow/web/.next/standalone/server.js -H 0.0.0.0 -p ${INTERNAL_PORT} & pid=$!; trap 'kill $pid' TERM INT; wait $pid"`
          ])
    ];

    console.log("[startProjectContainer] RUN CMD:\n", runArgs.join(" "));
    timed(runArgs.join(" "), 'docker-run');
    
    const containerUrl = resolveContainerUrl(String(hostPort));

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