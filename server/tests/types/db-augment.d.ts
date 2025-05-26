import 'pg';

declare module 'pg' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Pool {
    /** ONLY AVAILABLE IN TESTS – erases spies on pool + fake client */
    __resetFakeClient: () => void;
  }
}

/* Next line makes TS treat the default export in our mock as a Pool */
declare const poolMock: import('pg').Pool;
export default poolMock; 