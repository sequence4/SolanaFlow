import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

loadDotenv({
  path: path.resolve(__dirname, '..', '.env'),
  override: true          // file should win over blanks made by earlier loads
});

/* Quick sanity so you see the value every time the server starts */
console.debug(
  '[bootstrapEnv] DOCKER_HOST =',
  process.env.DOCKER_HOST ?? '<undefined>'
);

/* Abort early if the critical var is still missing ------------------------- */
if (!process.env.DOCKER_HOST || !process.env.DOCKER_HOST.trim()) {
  console.error('[bootstrapEnv] DOCKER_HOST missing – aborting startup');
  process.exit(1);
}

/* ─── make DOCKER_HOST immutable so later dotenv loads can't clear it ─── */
Object.defineProperty(process.env, 'DOCKER_HOST', {
  writable: false,
  configurable: false
});