import { Pool } from 'pg'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv()  

const envFile = `.env.${process.env.NODE_ENV || 'development'}`
loadEnv({ path: resolve(process.cwd(), envFile) })

const pool =
  process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool({
        user:     process.env.DB_USER,
        host:     process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port:     Number(process.env.DB_PORT ?? 5432)
      })

export default pool
