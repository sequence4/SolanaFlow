/* Tell TypeScript what the @db module looks like.
   - no runtime import/exports
   - no duplicate identifiers
*/
declare module '@db' {
  import type { Pool } from 'pg';

  /** the mock Pool instance returned at runtime */
  const poolMock: Pool & { __resetFakeClient(): void };

  /* CommonJS-style export so `import poolMock from "@db"` works */
  export = poolMock;
}