import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15')
    .withDatabase('testdb')
    .withUsername('test')
    .withPassword('test')
    .start();

  process.env.DATABASE_URL = container.getConnectionUri();
  process.env.TEST_ENV = 'test';
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  
  // We'll manually set up the database schema here if needed
  // For now, we'll just assume the tests will create tables as needed
});

afterAll(async () => {
  // Import without relying on path mapping
  try {
    // Only attempt to close db connection if the module can be loaded
    let dbModule: any;
    try {
      dbModule = require('../../../lib/db');
      const db = dbModule.db;
      if (db && typeof db.end === 'function') {
        await db.end();
      }
    } catch (error) {
      // Just ignore the error - the module might not be available in tests
    }
  } finally {
    // Always stop the container
    if (container) {
      await container.stop();
    }
  }
}); 