import 'pg';

declare module '@db' {
  import type { Pool } from 'pg';
  const pool: Pool & { __resetFakeClient(): void };
  export default pool;
}

/* Next line makes TS treat the default export in our mock as a Pool */
declare const poolMock: import('pg').Pool;
export default poolMock; 