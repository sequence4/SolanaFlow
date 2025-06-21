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