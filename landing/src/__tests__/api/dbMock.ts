import { Pool } from 'pg';
export let db: Pool;
export function setTestDb(testDb: Pool): void {
  db = testDb;
} 