import pool from '../../src/config/database';
import poolMock from '../__mocks__/@db';

/**
 * Replace the *next* call to pool.query (direct) **or**
 * the *next* call to (await pool.connect()).query (via client).
 */
export async function mockNextQueryOnce(result: any) {
  // direct pool.query
  (poolMock.query as jest.Mock).mockResolvedValueOnce(result);

  // client.query – get same fakeClient every time
  const fakeClient = await pool.connect();
  (fakeClient.query as jest.Mock).mockResolvedValueOnce(result);
} 