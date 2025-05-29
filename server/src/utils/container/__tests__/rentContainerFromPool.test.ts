import { rentContainerFromPool } from '../rentContainerFromPool';
import poolMock from '@db';
import { execSync } from 'child_process';
import { mockNextQueryOnce } from '../../../../tests/test-helpers/mockDbQueries';

jest.mock('child_process', () => ({ execSync: jest.fn() }));
const exec = execSync as jest.Mock;

afterEach(() => {
  jest.clearAllMocks();
  poolMock.__resetFakeClient();
});

describe('rentContainerFromPool()', () => {
  it('returns first free row and starts docker', async () => {
    await mockNextQueryOnce({
      rowCount: 1,
      rows: [{ name: 'ws-6001', port: 6001 }]
    });

    const res = await rentContainerFromPool();

    expect(res).toEqual({
      name: 'ws-6001',
      url : 'https://6001.ws.solanaflow.dev'
    });
    expect(exec).toHaveBeenCalledWith('docker start ws-6001', { stdio: 'ignore' });
  });

  it('returns null when no rows free', async () => {
    await mockNextQueryOnce({ rowCount: 0, rows: [] });

    const res = await rentContainerFromPool();

    expect(res).toBeNull();
    expect(exec).not.toHaveBeenCalled();
  });

  it('survives docker start error', async () => {
    await mockNextQueryOnce({
      rowCount: 1,
      rows: [{ name: 'ws-6002', port: 6002 }]
    });
    exec.mockImplementation(() => { throw new Error('boom'); });

    const res = await rentContainerFromPool();

    expect(res!.name).toBe('ws-6002');
    expect(exec).toHaveBeenCalled();
  });

  it('never hands out the same row twice in parallel', async () => {
    await mockNextQueryOnce({
      rowCount: 1,
      rows: [{ name: 'ws-6003', port: 6003 }]
    });
    await mockNextQueryOnce({ rowCount: 0, rows: [] });

    const [a, b] = await Promise.all([
      rentContainerFromPool(),
      rentContainerFromPool()
    ]);

    expect(a?.name).toBe('ws-6003');
    expect(b).toBeNull();
  });
});
