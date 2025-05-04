import { Pool } from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const certPath = process.env.PG_SSL_CA ?? join(process.cwd(), 'certs', 'rds-combined-ca-bundle.pem');

const dbUrl = process.env.DATABASE_URL;

if (dbUrl && dbUrl.includes('dbmasteruser')) {
  console.error('Refusing to start with privileged DB user');
  process.exit(1);
}

// Only read CA file if it exists
const ssl = existsSync(certPath)
  ? { rejectUnauthorized: true, ca: readFileSync(certPath, 'utf8') }
  : undefined;

export const db = new Pool({
  connectionString: dbUrl,
  max: 10,
  ssl
});
