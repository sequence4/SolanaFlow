// Shared mock used by every unit-test that imports "src/config/database"
const fakeClient = {
  query   : jest.fn(),
  release : jest.fn(),
  // helpers for BEGIN/COMMIT/ROLLBACK paths
  commit  : jest.fn(),
  rollback: jest.fn()
};

function reset() {
  Object.values(fakeClient).forEach(fn => (fn as jest.Mock).mockReset?.());
  (module.exports as any).query.mockReset();
}

export default {
  // code that calls pool.query(...)
  query  : jest.fn(),
  // code that calls pool.connect().query(...)
  connect: jest.fn().mockResolvedValue(fakeClient),
  // helper for tests
  __resetFakeClient: reset
}; 