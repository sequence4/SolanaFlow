import { execSync } from 'child_process';
import pool from 'src/config/database';

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
  if (getDockerFreeBytes() >= minBytes) return;

  console.warn(
    `[startProjectContainer] Low Docker disk (<${minBytes} bytes). ` +
    "Running docker system prune -af --volumes …"
  );
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
 * @returns The name of the created container
 */
export async function startProjectContainer(projId: string): Promise<string> {
  const name  = `userproj-${projId}-${Date.now()}`.slice(0, 63);        // 64-char limit
  // Pin to a specific digest to ensure we always get the correct image version
  const pinned = process.env.SF_RUNTIME_DIGEST ?? 
                 'sha256:87acc435d4f84e2acbeaebff3049d7d81eaf482924b8d70c4dd1025d199dbe4c'; // last successful build
  const baseImage = process.env.SOLANAFLOW_BUILD_IMAGE ?? 'ghcr.io/sequence4/solana-toolchain:runtime-latest';
  const image = `${baseImage}@${pinned}`;
  
  // 📦 three isolated caches
  const vCargo       = 'solanaflow-cargo-registry';
  const vTargetBuild = 'solanaflow-cargo-target';
  const vSccache     = 'solanaflow-sccache';

  try {
    /* 1 ─ ensure image is present & host-arch-compatible */
    execSync(`docker pull --platform linux/arm64 ${image}`, { stdio: 'inherit' });

    /* 2 ─ run container with explicit platform, project label & random host-port */
    // NEW: make sure the host has enough free space (≥ 3 GiB)
    ensureDockerSpace();

    const runArgs: string[] = [
      'docker', 'run',
      // Only add --pull=always for Docker 23.0+
      ...(dockerSupportsPullAlways() ? ['--pull=always'] : []),
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
      // publish container port 3000 → random host port
      '-p', '0:3000',
      image,
      // keep container up even if Next.js fails (easier debugging)
      'bash', '-lc',
      "trap : TERM INT; sleep infinity & wait & " +
      "node /usr/share/solanaflow/web/.next/standalone/server.js"
    ];

    execSync(runArgs.join(' '), { stdio: 'inherit' });

    return name;
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