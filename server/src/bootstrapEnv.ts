import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

/* ──────────────────────────────────────────────────────────────
 * Load the single .env file at project root
 * ( ../ relative to this config/ folder )
 * ──────────────────────────────────────────────────────────── */
loadDotenv({
  path: path.resolve(__dirname, '..', '.env'),
});

/* ─── Quick visibility whenever the backend boots ───────────── */
console.debug(
  '[bootstrapEnv] DOCKER_HOST =',
  process.env.DOCKER_HOST ?? '<unset>',
);
console.debug(
  '[bootstrapEnv] FORCE_REMOTE_DOCKER =',
  process.env.FORCE_REMOTE_DOCKER ?? '<unset>',
);

/* ─── Guard logic ──────────────────────────────────────────────
 * If the developer explicitly sets  FORCE_REMOTE_DOCKER=1
 * we *require* a DOCKER_HOST (ssh:// or tcp://) and abort early
 * if it’s missing.  In local-WSL dev you normally leave
 * FORCE_REMOTE_DOCKER unset, so the backend will happily use
 * the default Unix socket /var/run/docker.sock.
 * ──────────────────────────────────────────────────────────── */
/*
if (
  process.env.FORCE_REMOTE_DOCKER === '1' &&
  (!process.env.DOCKER_HOST || process.env.DOCKER_HOST.trim() === '')
) {
  console.error(
    '[bootstrapEnv] FORCE_REMOTE_DOCKER is 1 but DOCKER_HOST is missing – aborting startup',
  );
  process.exit(1);
}
*/

/* Optional: ensure the local socket path is set so downstream
 * helpers (e.g. dockerode) have a consistent default.
 * We warn but do not abort – this keeps behaviour flexible.
 */
if (
  process.env.FORCE_REMOTE_DOCKER !== '1' &&
  (!process.env.DOCKER_SOCKET || process.env.DOCKER_SOCKET.trim() === '')
) {
  console.warn(
    '[bootstrapEnv] DOCKER_SOCKET not set; defaulting to /var/run/docker.sock',
  );
  process.env.DOCKER_SOCKET = '/var/run/docker.sock';
}
