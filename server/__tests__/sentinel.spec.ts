/**
 * Unit-test for the WRITE_SRCS sentinel.
 *
 * We fully mock the pg Pool instance that taskUtils imports via
 * `../config/database`, giving it a `query` jest-fn so TypeScript
 * sees the correct shape and we can control results.
 */
import { markWriteDone, waitForTaskCompletion } from '../src/utils/taskUtils';
import pool from '../src/config/database';

/* -----------------------------------------------------------
 * 1. provide a typed mock for pool.query
 * --------------------------------------------------------- */
jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },      // satisfies Pool-like shape
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const mockedQuery = (pool as unknown as { query: jest.Mock }).query;

/* -----------------------------------------------------------
 * 2. shared row object we mutate during the test
 * --------------------------------------------------------- */
const mockRow = { status: 'queued', result: null };

beforeEach(() => {
  // each test starts with a queued row
  mockedQuery.mockResolvedValue({ rows: [mockRow] });
});

afterEach(() => {
  mockedQuery.mockReset();
});

describe('WRITE_SRCS sentinel', () => {
  it('waits until markWriteDone flips status', async () => {
    const projectId = 'xyz';

    // background: after 100 ms pretend the row turned to succeed
    setTimeout(() => {
      mockRow.status = 'succeed';
    }, 100);

    // create the sentinel row (uses createTask)
    await markWriteDone(projectId);

    // should resolve once our timeout flips the status
    const status = await waitForTaskCompletion(`WRITE_SRCS_${projectId}`, 10, 50);

    expect(status).toBe('succeed');
    expect(mockedQuery).toHaveBeenCalled();   // sanity – poll happened
  });
}); 