import path from 'node:path';
import { config as loadEnv } from 'dotenv';

/**
 * Load server/.env *before* anything else is imported.
 * We resolve relative to this file so it works in dev (ts-node) and prod (dist/).
 */
loadEnv({
  path: path.resolve(__dirname, '..', '.env'),
  override: false,          // keep any variables you already exported in the shell
}); 