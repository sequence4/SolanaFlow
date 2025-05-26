/* server/tests/__mocks__/@db.ts */
import type { Pool } from 'pg';

/* ---- internal fake client ---- */
const fakeClient = {
  query   : jest.fn(),
  release : jest.fn(),
  commit  : jest.fn(),
  rollback: jest.fn(),
};

/* helper that wipes spies between tests */
function __resetFakeClient() {
  Object.values(fakeClient).forEach(fn => (fn as jest.Mock).mockReset());
  (poolMock.query as jest.Mock).mockReset();
}

/* ---- exported pool substitute ---- */
const poolMock: Pool & { __resetFakeClient: () => void } = {
  // @ts-expect-error – only the members we actually call are implemented
  query  : jest.fn(),
  // @ts-expect-error
  connect: jest.fn().mockResolvedValue(fakeClient),
  __resetFakeClient,
};

export default poolMock; 