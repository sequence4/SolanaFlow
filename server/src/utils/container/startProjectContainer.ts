/**
 * SF_HOST_PORT — bind container port 3000 to this host port.
 * Default: 31000.  Useful for local dev so the browser URL is always predictable.
 */
import { execSync } from 'child_process';
import pool from 'src/config/database';
import fs from 'fs';
import path from 'path';
import { getProjectRootPath } from 'src/utils/fileUtils';
import eventBus from '../../lib/eventBus';

// Progress tracking function for container setup operations
function sendContainerSetupProgress(taskId: string, taskName: string, message: string, pct: number, thoughts: string[] = []) {
  eventBus.emit('task-update', { taskId, pct, message });
  
  const event = {
    type: 'container-setup-progress',
    taskId,
    taskName,
    stage: 'environment',
    message,
    pct,
    thoughts,
    timestamp: Date.now()
  };
  
  // Emit to SSE for frontend
  //console.log(JSON.stringify(event));
}

function startContainerTask(taskId: string, taskName: string) {
  eventBus.emit('task-start', { taskId, taskName, stage: 'environment' });
  
  const event = {
    type: 'task-start',
    taskId,
    taskName,
    stage: 'environment',
    status: 'running',
    timestamp: Date.now()
  };
  
  console.log(JSON.stringify(event));
}

function completeContainerTask(taskId: string, message: string = 'Task completed') {
  eventBus.emit('task-complete', { taskId, message });
  
  const event = {
    type: 'task-complete',
    taskId,
    message,
    status: 'completed',
    timestamp: Date.now()
  };
  
  console.log(JSON.stringify(event));
}

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

/** Host side HTTP port.  
 *  • If SF_HOST_PORT is set → use that.  
 *  • Otherwise fall back to the old auto-picker.               */
const DEFAULT_HOST_PORT = 31000;

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
 * Find available ports for Solana validator
 */
export async function findAvailablePorts(): Promise<{ rpc: number, ws: number, faucet: number }> {
  const net = require('net');
  
  const checkPort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '0.0.0.0');
    });
  };
  
  // Try ranges starting from 28899 (less common)
  const basePort = 28899;
  for (let offset = 0; offset < 100; offset += 10) {
    const rpc = basePort + offset;
    const ws = rpc + 1;
    const faucet = rpc + 2;
    
    const rpcAvailable = await checkPort(rpc);
    const wsAvailable = await checkPort(ws);
    const faucetAvailable = await checkPort(faucet);
    
    if (rpcAvailable && wsAvailable && faucetAvailable) {
      console.log(`[CONTAINER] Found available ports - RPC: ${rpc}, WS: ${ws}, Faucet: ${faucet}`);
      return { rpc, ws, faucet };
    }
  }
  
  // Fallback to default ports if no range available
  console.warn('[CONTAINER] No ports found in range 28899-29899, using defaults');
  return { rpc: 18899, ws: 18900, faucet: 19900 };
}

/**
 * Clean up existing containers for a project
 */
async function cleanupExistingContainers(projectId: string): Promise<void> {
  try {
    // Find any existing containers for this project
    const listCmd = `docker ps -a --filter "name=userproj-${projectId}" --format "{{.Names}}"`;
    const existingContainers = execSync(listCmd, { encoding: 'utf8' }).trim();
    
    if (existingContainers) {
      const containers = existingContainers.split('\n').filter(c => c);
      for (const container of containers) {
        console.log(`[CONTAINER] Cleaning up existing container: ${container}`);
        try {
          execSync(`docker stop ${container} 2>/dev/null || true`, { stdio: 'ignore' });
          execSync(`docker rm ${container} 2>/dev/null || true`, { stdio: 'ignore' });
        } catch (e) {
          console.warn(`[CONTAINER] Failed to cleanup ${container}:`, e);
        }
      }
    }
  } catch (e) {
    console.log('[CONTAINER] No existing containers to clean up');
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
  // Fallback image when the caller doesn't set SOLANAFLOW_BUILD_IMAGE.
  // Use the native amd64 build that contains the warmed SBF cache.
  const image = process.env.SOLANAFLOW_BUILD_IMAGE
              ?? 'ghcr.io/sequence4/solana-toolchain:runtime-latest-amd64';

  /** Toggle: `SF_DEV_SERVER=1` ⇒ start `next dev` instead of standalone build */
  const useDevServer = devMode || process.env.SF_DEV_SERVER === '1';
  
  // Determine project root path and ensure host directory exists for mounting
  const rootPath = await getProjectRootPath(projId);
  const hostRoot = process.env.ROOT_FOLDER;
  if (!hostRoot) {
    throw new Error('ROOT_FOLDER environment not set – cannot locate project directory');
  }
  const hostProjectDir = path.join(hostRoot, rootPath);
  if (!fs.existsSync(hostProjectDir)) {
    fs.mkdirSync(hostProjectDir, { recursive: true });
  }
  const hostWebDir = path.join(hostProjectDir, 'web');
  if (!fs.existsSync(hostWebDir)) {
    fs.mkdirSync(hostWebDir, { recursive: true });
  }
  
  // Inject Program ID into container environment if it exists for this project
  let programIdEnv: string[] = [];
  try {
    const res = await pool.query('SELECT details FROM solanaproject WHERE id = $1', [projId]);
    if (res.rows.length > 0) {
      const detailsData = res.rows[0].details;
      const detailsObj = (typeof detailsData === 'object' && detailsData !== null)
        ? detailsData
        : JSON.parse(detailsData || '{}');
      if (detailsObj.programId) {
        if (detailsObj.projectState && detailsObj.projectState.deployed) {
          programIdEnv = ['-e', `PROGRAM_ID=${detailsObj.programId}`, '-e', `NEXT_PUBLIC_PROGRAM_ID=${detailsObj.programId}`];
          //console.log(`[startProjectContainer] Found Program ID ${detailsObj.programId} – adding to container env`);
        } else {
          console.log(`[startProjectContainer] Project has Program ID but not yet deployed – skipping PROGRAM_ID injection to avoid stale ID`);
        }
      }
    }
  } catch (err) {
    console.error('[startProjectContainer] Could not fetch program ID:', err);
  }
  
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
  const vYarnCache   = 'solanaflow-yarn-cache';      // NEW – keeps registry tarballs
  const vNextCache   = 'solanaflow-next-cache';

  try {
    process.env.DOCKER_CLI_DEBUG = process.env.DOCKER_CLI_DEBUG ?? '1'; // show HTTP calls
    
    // Start container setup tracking
    startContainerTask('env-docker-init', 'Docker Environment Initialization');
    sendContainerSetupProgress('env-docker-init', 'Docker Environment Initialization', 'Checking Docker configuration...', 5, [
      'Analyzing Docker daemon configuration',
      'Validating platform compatibility (linux/amd64 vs linux/arm64)',
      'Setting up CLI debug mode for better visibility',
      'This ensures we can troubleshoot any Docker issues quickly'
    ]);
    
    // ── pin to immutable digest and then re-tag it so `docker run` will work
    sendContainerSetupProgress('env-docker-init', 'Docker Environment Initialization', 'Resolving container image digest...', 10, [
      'Inspecting container image for immutable digest reference',
      'This prevents version drift and ensures reproducible builds',
      'Using digest-based references for maximum stability'
    ]);
    
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
          sendContainerSetupProgress('env-docker-init', 'Docker Environment Initialization', 'Pinning image to digest...', 15, [
            `Found immutable digest: ${digest.substring(0, 20)}...`,
            'Tagging digest with friendly name for Docker run compatibility',
            'This guarantees we use exactly the same image layers every time'
          ]);
          execSync(`docker tag ${digest} ${image}`, { stdio: 'inherit' });
          imageRef = image;          // pinned
        }
      } catch (e) {
        console.warn('[startProjectContainer] no digest found – using tag only');
        sendContainerSetupProgress('env-docker-init', 'Docker Environment Initialization', 'Using tag reference (no digest)...', 15, [
          'No digest found, falling back to tag-based reference',
          'This is still safe but slightly less reproducible',
          'Modern registries usually provide digests automatically'
        ]);
        imageRef = image;            // safe fallback
      }
    } catch (e) {
      console.warn("[startProjectContainer] digest tagging failed; using tag:", e);
      sendContainerSetupProgress('env-docker-init', 'Docker Environment Initialization', 'Using image tag as fallback...', 15, [
        'Digest pinning failed, using tag reference instead',
        'This is a safe fallback but less deterministic',
        'Container will still work normally'
      ]);
      imageRef = image;
    }

    /* 1b ─ ensure the traefik network exists on the remote host */
    sendContainerSetupProgress('env-docker-init', 'Docker Environment Initialization', 'Setting up Docker networking...', 20, [
      'Checking for Traefik reverse proxy network',
      'This network enables automatic HTTPS and routing',
      'Essential for web app accessibility from external hosts'
    ]);
    
    try {
      execSync('docker network inspect traefik', { stdio: 'ignore' });
      sendContainerSetupProgress('env-docker-init', 'Docker Environment Initialization', 'Traefik network found', 25, [
        'Existing Traefik network is ready',
        'No need to create additional networking infrastructure',
        'Container will automatically join this network'
      ]);
    } catch {
      console.warn('[startProjectContainer] creating missing "traefik" network');
      sendContainerSetupProgress('env-docker-init', 'Docker Environment Initialization', 'Creating Traefik network...', 25, [
        'No Traefik network found, creating new bridge network',
        'This network will handle reverse proxy routing',
        'Enables automatic SSL termination and subdomain routing'
      ]);
      timed('docker network create traefik --driver bridge', 'net-create');
    }
    
    completeContainerTask('env-docker-init', 'Docker environment initialized');
    
    /* 1c ─ Clean up any existing containers for this project */
    startContainerTask('env-cleanup', 'Container Cleanup');
    sendContainerSetupProgress('env-cleanup', 'Container Cleanup', 'Cleaning up existing containers...', 28, [
      'Checking for existing project containers',
      'Stopping and removing old containers',
      'This prevents port conflicts and resource leaks'
    ]);
    
    await cleanupExistingContainers(projId);
    completeContainerTask('env-cleanup', 'Existing containers cleaned up');

    /* 2 ─ run container with explicit platform, project label & random host-port */
    startContainerTask('env-disk-check', 'Storage Space Verification');
    sendContainerSetupProgress('env-disk-check', 'Storage Space Verification', 'Checking available disk space...', 30, [
      'Ensuring minimum 3GB free space for container operations',
      'Large Rust projects can consume significant disk space',
      'Will trigger cleanup if space is insufficient'
    ]);
    
    // NEW: make sure the host has enough free space (≥ 3 GiB)
    ensureDockerSpace();
    completeContainerTask('env-disk-check', 'Sufficient disk space verified');
    
    /* ------------------------------------------------------------------
     * Pull the image for the platform selected above.  This guarantees
     * that    SF_DOCKER_PLATFORM=linux/amd64    on WSL/Intel laptops
     * actually fetches x86-64 layers and never falls back to QEMU. 
     * ------------------------------------------------------------------ */
    startContainerTask('env-image-pull', 'Container Image Download');
    sendContainerSetupProgress('env-image-pull', 'Container Image Download', `Pulling ${targetPlatform} image...`, 35, [
      `Target platform: ${targetPlatform}`,
      'Downloading pre-built Solana development environment',
      'This image contains Rust, Anchor framework, and Solana CLI',
      'May take a few minutes on first run'
    ]);
    
    timed(`docker pull --platform ${targetPlatform} ${image}`, 'pull');
    
    sendContainerSetupProgress('env-image-pull', 'Container Image Download', 'Image download completed', 95, [
      'All container layers downloaded successfully',
      'Image contains pre-cached dependencies to speed up builds',
      'Ready to start container with development environment'
    ]);
    
    completeContainerTask('env-image-pull', 'Container image ready');

    // Container configuration and startup
    startContainerTask('env-container-config', 'Container Configuration');
    sendContainerSetupProgress('env-container-config', 'Container Configuration', 'Configuring container networking...', 40, [
      'Selecting available port for web application',
      'Checking port availability to avoid conflicts',
      'Setting up reverse proxy routing configuration'
    ]);

    // choose the public port deterministically so the UI link is stable
    const hostPort = process.env.SF_HOST_PORT
      ? Number(process.env.SF_HOST_PORT) 
      : pickFreePort();               // ← fallback for legacy callers

    if (portInUse(String(hostPort))) {
      throw new Error(`[startProjectContainer] requested hostPort ${hostPort} already in use`);
    }
    
    sendContainerSetupProgress('env-container-config', 'Container Configuration', `Port ${hostPort} allocated successfully`, 45, [
      `Container will be accessible on port ${hostPort}`,
      'Port mapping ensures external connectivity',
      'Reverse proxy will handle SSL termination automatically'
    ]);
    
    // Allocate dynamic ports for Solana validator
    sendContainerSetupProgress('env-container-config', 'Container Configuration', 'Finding available ports for Solana...', 47, [
      'Scanning for available ports in range 28899-29899',
      'Ensuring no conflicts with existing services',
      'This prevents port binding errors'
    ]);
    
    const ports = await findAvailablePorts();
    
    // Store allocated ports in database
    await pool.query(
      `UPDATE solanaproject 
       SET details = jsonb_set(
         COALESCE(details, '{}'::jsonb),
         '{containerPorts}',
         $1::jsonb
       )
       WHERE id = $2`,
      [JSON.stringify(ports), projId]
    );
    
    console.log(`[CONTAINER] Allocated ports for project ${projId}: RPC=${ports.rpc}, WS=${ports.ws}, Faucet=${ports.faucet}`);
    
    const runArgs: string[] = [
      'docker', 'run',
      ...(withPullAlways ? ['--pull=always'] : []),     // refresh tag (Docker ≥ 23)
      '-d',                                            // detached – let pipeline continue
      '--user', '0:0',                                 // 🔸 run container as root (fixes mkdir EACCES)
      '--platform', targetPlatform,                    // dynamic arch selection
      '--name', name,
      '--label', `solanaflow.project=${projId}`,
      '--restart', 'unless-stopped',
      ...(sizeOptSupported() ? ['--storage-opt', 'size=20G'] : []),  // guard FS quota
      '-v', `${vCargo}:/root/.cargo`,
      '-v', `${vSccache}:/opt/sccache`,
      '-v', `${vTargetBuild}:/usr/src/target`,
      '-v', `${vYarnCache}:/usr/local/share/.cache/yarn/v6`,
      '-v', `${vNextCache}:/usr/src/${rootPath}/web/.next`,
      // Mount host project directory into the container at the correct path
      '-v', `${hostProjectDir}:/usr/src/${rootPath}`,
      '-e', 'CARGO_TARGET_DIR=/usr/src/target',
      '-e', 'HOSTNAME=0.0.0.0',
      '-e', 'CARGO_BUILD_JOBS=1',
      '-e', 'RUSTC_WRAPPER=sccache',
      '-e', 'YARN_CACHE_FOLDER=/usr/local/share/.cache/yarn/v6',
      // RUSTFLAGS is exported in /tmp/build.sh; keep it *out* of docker run to avoid quoting issues
      '-e', `APP_ID=${projId}`,
      '-e', `APP_BASE_PATH=/dapp/${projId}`,
      '-e', `SF_DEV_SERVER=${useDevServer ? '1' : ''}`,
      '-e', 'COREPACK_ENABLE_STRICT=0',           // ← allow Yarn inside "web/"
      ...programIdEnv,
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
      // Expose Solana validator ports - mapped to dynamic host ports to avoid conflicts
      '-p', `${ports.rpc}:8899`,  // RPC: dynamic host port -> container 8899
      '-p', `${ports.ws}:8900`,   // WebSocket: dynamic host port -> container 8900
      '-p', `${ports.faucet}:9900`,  // Faucet: dynamic host port -> container 9900
      // Override entrypoint to avoid permission issues
      '--entrypoint', '/bin/sh',
      imageRef,
    ];

    sendContainerSetupProgress('env-container-config', 'Container Configuration', 'Preparing container startup command...', 60, [
      `Mode: ${useDevServer ? 'Development (hot-reload)' : 'Production (standalone)'}`,
      'Configuring Next.js web server startup',
      'Setting up graceful shutdown handlers',
      'Will copy base template if project is new'
    ]);

    // Add the appropriate command based on dev vs production mode
    if (useDevServer) {
      sendContainerSetupProgress('env-container-config', 'Container Configuration', 'Configuring development mode...', 65, [
        'Development server with hot-reload enabled',
        'React Fast Refresh will update code instantly',
        'Perfect for iterative development workflow'
      ]);
      // Development mode with Next.js dev server
      runArgs.push(
        '-c',
        `if [ ! -f /usr/src/${rootPath}/web/package.json ]; then ` +
        `  cp -af /usr/share/solanaflow/web/. /usr/src/${rootPath}/web/ 2>/dev/null || true; ` +
        `fi && ` +
        `cd /usr/src/${rootPath}/web && ` +
        `export NEXT_DISABLE_REACT_REFRESH=\${NEXT_DISABLE_REACT_REFRESH:-0} && ` +
        `npx next dev -H 0.0.0.0 -p ${INTERNAL_PORT}`
      );
    } else {
      sendContainerSetupProgress('env-container-config', 'Container Configuration', 'Configuring production mode...', 65, [
        'Production server with optimized build',
        'Lower resource usage, better performance',
        'Standalone server ready for deployment'
      ]);
      // Production mode with standalone Next.js server
      runArgs.push(
        '-c',
        `if [ ! -f /usr/src/${rootPath}/web/package.json ]; then ` +
        `  cp -af /usr/share/solanaflow/web/. /usr/src/${rootPath}/web/ 2>/dev/null || true; ` +
        `fi && ` +
        `cd /usr/src/${rootPath}/web && ` +
        `until [ -d .next ]; do sleep 1; done && ` +
        `node .next/standalone/server.js -H 0.0.0.0 -p ${INTERNAL_PORT}`
      );
    }

    sendContainerSetupProgress('env-container-config', 'Container Configuration', 'Starting container...', 70, [
      'Executing docker run command',
      'Container will start in detached mode',
      'All volumes and environment variables configured'
    ]);

    //console.log("[startProjectContainer] RUN CMD:\n", runArgs.join(" "));
    timed(runArgs.join(" "), 'docker-run');
    
    sendContainerSetupProgress('env-container-config', 'Container Configuration', 'Container started, setting up tools...', 80, [
      'Container is now running successfully',
      'Setting up Yarn package manager via Corepack',
      'Preparing development environment'
    ]);

    // Post-start configuration: Create validator script and directories
    try {
      console.log('[Container setup] Creating validator script and directories...');
      
      // Create directories
      execSync(`docker exec ${name} sh -c 'mkdir -p /usr/local/validator-logs'`);
      execSync(`docker exec ${name} sh -c 'mkdir -p /usr/src/${rootPath}/web'`);
      
      // Create a complete validator script in /tmp first (writable by any user)
      const validatorScript = [
        '#!/bin/sh',
        'case "$1" in',
        '  status)',
        '    if [ -f /usr/local/validator-logs/validator.pid ]; then',
        '      PID=$(cat /usr/local/validator-logs/validator.pid)',
        '      if ps -p $PID > /dev/null 2>&1; then',
        '        echo "Validator is running with PID $PID"',
        '        echo "RPC endpoint is responsive"',
        '        exit 0',
        '      fi',
        '    fi',
        '    echo "Validator is not running"',
        '    exit 1',
        '    ;;',
        '  reset)',
        '    if [ -f /usr/local/validator-logs/validator.pid ]; then',
        '      PID=$(cat /usr/local/validator-logs/validator.pid)',
        '      kill $PID 2>/dev/null || true',
        '    fi',
        '    rm -rf /usr/local/validator-logs/*',
        '    mkdir -p /usr/local/validator-logs',
        '    solana-test-validator --reset --bind-address 0.0.0.0 --rpc-port 8899 --faucet-port 9900 > /usr/local/validator-logs/validator.log 2>&1 &',
        '    echo $! > /usr/local/validator-logs/validator.pid',
        '    sleep 2',
        '    echo "Validator reset and started successfully"',
        '    echo "Validator is ready"',
        '    ;;',
        '  *)',
        '    if [ -f /usr/local/validator-logs/validator.pid ]; then',
        '      PID=$(cat /usr/local/validator-logs/validator.pid)',
        '      if ps -p $PID > /dev/null 2>&1; then',
        '        echo "Validator already running with PID $PID"',
        '        echo "Validator is ready"',
        '        exit 0',
        '      fi',
        '    fi',
        '    mkdir -p /usr/local/validator-logs',
        '    solana-test-validator --bind-address 0.0.0.0 --rpc-port 8899 --faucet-port 9900 > /usr/local/validator-logs/validator.log 2>&1 &',
        '    echo $! > /usr/local/validator-logs/validator.pid',
        '    sleep 2',
        '    echo "Validator started successfully"',
        '    echo "Validator is ready"',
        '    ;;',
        'esac'
      ];
      
      // Write the script line by line
      for (let i = 0; i < validatorScript.length; i++) {
        const line = validatorScript[i].replace(/'/g, "'\\''"); // Escape single quotes
        const redirect = i === 0 ? '>' : '>>';
        execSync(`docker exec ${name} sh -c 'echo '"'"'${line}'"'"' ${redirect} /tmp/start-validator.sh'`);
      }
      execSync(`docker exec ${name} sh -c 'chmod +x /tmp/start-validator.sh'`);
      
      // Try to copy to /usr/local/bin (may fail if no permissions)
      try {
        execSync(`docker exec ${name} sh -c 'cp /tmp/start-validator.sh /usr/local/bin/'`);
        console.log('[Container setup] Validator script created in /usr/local/bin');
      } catch {
        console.log('[Container setup] Could not copy to /usr/local/bin, script available in /tmp');
      }
      
      console.log('[Container setup] Post-start configuration completed');
    } catch (e) {
      console.warn('[Container setup] Post-start configuration failed:', e);
    }

    // ─── ensure Yarn 1.x binary is available via Corepack ──────────────────
    startContainerTask('env-tools-setup', 'Development Tools Setup');
    sendContainerSetupProgress('env-tools-setup', 'Development Tools Setup', 'Installing Yarn package manager...', 85, [
      'Activating Corepack for package manager selection',
      'Installing Yarn 1.22.22 for JavaScript dependencies',
      'This enables fast package installation and caching'
    ]);
    
    try {
      timed(
        `docker exec ${name} bash -lc "corepack enable && corepack prepare yarn@1.22.22 --activate"`,
        'corepack-prepare'
      );
      sendContainerSetupProgress('env-tools-setup', 'Development Tools Setup', 'Yarn installed successfully', 95, [
        'Yarn package manager is ready',
        'Frontend dependencies can now be installed quickly',
        'Development environment fully configured'
      ]);
    } catch (e) {
      console.warn('[startProjectContainer] corepack prepare failed:', e);
      sendContainerSetupProgress('env-tools-setup', 'Development Tools Setup', 'Yarn setup failed (non-critical)', 95, [
        'Yarn installation encountered an issue',
        'Container is still functional for Rust development',
        'JavaScript features may have limited functionality'
      ]);
    }
    
    completeContainerTask('env-tools-setup', 'Development tools ready');
    completeContainerTask('env-container-config', 'Container fully configured');

    const containerUrl = resolveContainerUrl(String(hostPort));

    //console.log(`[startProjectContainer] ➜  ${containerUrl}`);
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