import poolMock, { fakeClient } from '../__mocks__/@db';

/**
 * Replace the *next* call to pool.query (direct) **or**
 * the *next* call to (await pool.connect()).query (via client).
 */
export function mockNextQueryOnce(result: any) {
  (poolMock.query   as jest.Mock).mockResolvedValueOnce(result);
  (fakeClient.query as jest.Mock).mockResolvedValueOnce(result);
} 