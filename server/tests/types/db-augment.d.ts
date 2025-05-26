declare module 'src/config/database' {
  interface PoolMock {
    query: jest.Mock;
    connect: () => Promise<any>;
    __resetFakeClient: () => void;
  }
  const poolMock: PoolMock;
  export default poolMock;
} 