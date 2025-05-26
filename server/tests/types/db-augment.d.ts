import 'pg';

declare module 'pg' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Pool {
    /** TEST-ONLY helper – wipes spies */
    __resetFakeClient: () => void;
  }
}

/* Next line makes TS treat the default export in our mock as a Pool */
declare const poolMock: import('pg').Pool;
export default poolMock; 