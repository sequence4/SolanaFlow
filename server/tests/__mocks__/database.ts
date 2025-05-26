// Shared mock used by every unit-test that imports "src/config/database"
const fakeClient = {
  query   : jest.fn(),
  release : jest.fn(),
  // helpers for BEGIN/COMMIT/ROLLBACK paths
  commit  : jest.fn(),
  rollback: jest.fn()
};

// ──────────────────────────────────────────────────────────────
// helper that actually wipes spies on every test
export const __resetFakeClient = () => {
  Object.values(fakeClient).forEach(fn => (fn as any).mockReset?.());
  (pool.query as jest.Mock).mockReset();
};

const pool = {
  // code that calls pool.query(...)
  query  : jest.fn(),
  // code that calls pool.connect().query(...)
  connect: jest.fn().mockResolvedValue(fakeClient),
  __resetFakeClient,               // keep as property (runtime)
};

export default pool; 