import { Pool } from 'pg'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv()                                     // loads .env
loadEnv({ path: resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`) })

const isProd = process.env.NODE_ENV === 'production'   // 👈 single switch

export default new Pool({
  connectionString: process.env.DATABASE_URL,          // one URL everywhere
  ssl: isProd
       ? { rejectUnauthorized: false }  // prod/staging ➜ encrypted
       : false                          // local/CI ➜ no SSL hand-shake
})
