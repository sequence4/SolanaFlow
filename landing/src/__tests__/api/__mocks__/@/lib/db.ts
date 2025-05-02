import { Pool } from 'pg';
export let db!: Pool;
export function initDb(connectionString: string) {
  db = new Pool({ connectionString });
}
export default { db }; 