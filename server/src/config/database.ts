import { Pool } from 'pg'

const isProd = process.env.NODE_ENV === 'production'   // 👈 single switch

export default new Pool({
  connectionString: process.env.DATABASE_URL,          // one URL everywhere
  ssl: isProd
       ? { rejectUnauthorized: false }  // prod/staging ➜ encrypted
       : false                          // local/CI ➜ no SSL hand-shake
})
