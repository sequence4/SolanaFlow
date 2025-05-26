// Shared mock used by every unit-test that imports "src/config/database"
const fakeClient = {
  query: jest.fn(),
  release: jest.fn(),
  // helpers for BEGIN/COMMIT/ROLLBACK paths
  commit: jest.fn(),
  rollback: jest.fn()
};

// ──────────────────────────────────────────────────────────────
// helper that actually wipes spies on every test
export const __resetFakeClient = () => {
  Object.values(fakeClient).forEach(fn => (fn as any).mockReset?.());
  (poolMock.query as jest.Mock).mockReset();
};

const poolMock = {
  query: jest.fn(),
  connect: jest.fn().mockResolvedValue(fakeClient),
  __resetFakeClient,               // keep as property (runtime)
};

export default poolMock; 