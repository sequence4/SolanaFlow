declare module 'src/config/database' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Pool { 
    __resetFakeClient: () => void;
    connect: () => Promise<any>;
    query: jest.Mock;
  }
  export const __resetFakeClient: () => void;
  export default Pool;
} 