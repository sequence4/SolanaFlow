import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { initDb } from './__mocks__/@/lib/db';

let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15')
    .withDatabase('testdb')
    .withUsername('test')
    .withPassword('test')
    .start();

  const uri = container.getConnectionUri();
  process.env.DATABASE_URL = uri;
  initDb(uri);

  const { db } = await import('@/lib/db');
  await db.query(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      wallet_address TEXT,
      full_name TEXT,
      telegram_handle TEXT,
      twitter_handle TEXT,
      discord_username TEXT,
      referred_by TEXT,
      source TEXT,
      signup_ip TEXT,
      meta JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}, 30000);

afterAll(async () => {
  const { db } = await import('@/lib/db');
  await db.end();
  await container.stop();
}); 