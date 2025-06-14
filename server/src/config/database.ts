import { Pool } from 'pg'

const isProd = process.env.NODE_ENV === 'production'   // 👈 single switch

console.log('[DEBUG] DATABASE_URL =', process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim()
                  ?? 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
  max: 10,
  ssl: isProd
       ? { rejectUnauthorized: false }  // prod/staging ➜ encrypted
       : false                          // local/CI ➜ no SSL hand-shake
});
export default pool
