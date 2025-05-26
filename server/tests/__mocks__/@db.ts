/* server/tests/__mocks__/@db.ts */
import type { Pool } from 'pg';

/* ---- internal fake pg client ---- */
export const fakeClient = {
  query   : jest.fn(),
  release : jest.fn(),
  commit  : jest.fn(),
  rollback: jest.fn(),
};

/* helper that wipes spies between tests */
function __resetFakeClient() {
  Object.values(fakeClient).forEach(fn => (fn as jest.Mock).mockReset());
  (poolMock.query as jest.Mock).mockReset();

  // keep .connect() returning a fresh spy-reset fakeClient
  (poolMock.connect as jest.Mock).mockReset();
  (poolMock.connect as jest.Mock).mockResolvedValue(fakeClient);
}

/* ---- exported pool substitute ---- */
type PartialPool = Pick<Pool, 'query' | 'connect'>;

const poolMock: PartialPool & { __resetFakeClient(): void } = {
  query  : jest.fn(),
  connect: jest.fn().mockResolvedValue(fakeClient),
  __resetFakeClient,
};

export default poolMock; 