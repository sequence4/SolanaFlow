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

  /* ensure fakeClient keeps a fresh .query spy after every reset */
  fakeClient.query = jest.fn();
  (poolMock.connect as jest.Mock).mockReset().mockResolvedValue(fakeClient);
}

/* ---- exported pool substitute ---- */
type PartialPool = Pick<Pool, 'query' | 'connect'>;

const poolMock: PartialPool & { __resetFakeClient: () => void } = {
  query  : jest.fn(),
  /** always resolve to the same fake client */
  connect: jest.fn().mockResolvedValue(fakeClient),
  __resetFakeClient,
};

export default poolMock; 