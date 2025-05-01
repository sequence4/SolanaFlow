import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const ca = readFileSync(
  process.env.PG_SSL_CA ??
    join(process.cwd(), 'certs', 'rds-combined-ca-bundle.pem'),
  'utf8'
);

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  ssl: { rejectUnauthorized: true, ca }
});
