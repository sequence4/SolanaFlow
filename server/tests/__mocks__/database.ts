import type { Pool } from 'pg';

/* Shared mock returned whenever code imports "src/config/database" */

/* ---------- internal fake client ---------- */
type FakeFn = jest.Mock<any, any>;

const fakeClient = {
  query   : jest.fn() as FakeFn,
  release : jest.fn() as FakeFn,
  commit  : jest.fn() as FakeFn,
  rollback: jest.fn() as FakeFn,
};

/** Helper that wipes all spies between tests */
function __resetFakeClient() {
  // reset every spy on fakeClient PLUS the top-level pool query spy
  Object.values(fakeClient).forEach(fn => (fn as FakeFn).mockReset());
  (poolMock.query as FakeFn).mockReset();
}

/* ---------- pool mock ---------- */
const poolMock: Pool & { __resetFakeClient: () => void } = {
  // @ts-expect-error – we only implement the bits we use
  query  : jest.fn(),
  // @ts-expect-error
  connect: jest.fn().mockResolvedValue(fakeClient),
  /** expose the reset helper as a METHOD (runtime) */
  __resetFakeClient,
};

export default poolMock; 