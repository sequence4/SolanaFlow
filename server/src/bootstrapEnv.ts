import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

/* absolutised so it works from any CWD (ts-node or compiled JS) */
loadDotenv({
  path: path.resolve(__dirname, '..', '.env'), // server/.env
  override: false                        // shell > file if both define a key
}); 