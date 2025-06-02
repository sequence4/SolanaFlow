import { execSync } from 'child_process';
import pool from 'src/config/database';

/**
 * Starts a new Docker container for a project
 * 
 * @param projId - The project ID
 * @returns The name of the created container
 */
export async function startProjectContainer(projId: string): Promise<string> {
  const name  = `userproj-${projId}-${Date.now()}`.slice(0, 63);        // 64-char limit
  const image = process.env.SOLANAFLOW_BUILD_IMAGE ?? 'ghcr.io/sequence4/solana-toolchain:latest';
  // 📦 shared compilation cache lives here
  const volume = 'solanaflow-cargo-cache';

  try {
    /* 1 ─ ensure image is present & host-arch-compatible */
    execSync(`docker pull --platform linux/arm64 ${image}`, { stdio: 'inherit' });

    /* 2 ─ run container with explicit platform, project label & random host-port */
    execSync(
      `docker run -d --platform linux/arm64 \
       --name  ${name} \
       --label solanaflow.project=${projId} \
       -v ${volume}:/root/.cargo \
       -v ${volume}:/opt/sccache \
       -v ${volume}:/usr/src/.cargo-target \
       -p 0.0.0.0::3000 \
       ${image} \
       bash -c "cd /usr/src && tail -f /dev/null"`,
      { stdio: 'inherit' }
    );

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