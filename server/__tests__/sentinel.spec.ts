import { markWriteDone, waitForTaskCompletion } from '../utils/taskUtils';
import * as pool from '../config/database';

// mock DB helpers – we only need a rows object
const mockRow = { status: 'queued', result: null };
jest.spyOn(pool, 'query').mockImplementation(async () => ({ rows: [mockRow] }));

describe('WRITE_SRCS sentinel', () => {
  it('waits until markWriteDone flips status', async () => {
    const projectId = 'xyz';
    // background: after 100 ms flip the row to succeed
    setTimeout(() => { mockRow.status = 'succeed'; }, 100);
    markWriteDone(projectId);                // creates the row
    const status = await waitForTaskCompletion(`WRITE_SRCS_${projectId}`, 10, 50);
    expect(status).toBe('succeed');
  });
}); 