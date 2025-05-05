import { Pool, QueryConfig, QueryResult } from 'pg';

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined,
});

/**
 * Safe wrapper around pg.Pool#query.
 * Returns an empty result instead of throwing if PG is down **in dev**.
 */
export const safeQuery = async <
  T extends Record<string, unknown> = Record<string, unknown>
>(
  textOrConfig: string | QueryConfig,
  values?: unknown[],
): Promise<QueryResult<T>> => {
  try {
    return typeof textOrConfig === 'string'
      ? await db.query<T>(textOrConfig, values)
      : await db.query<T>(textOrConfig);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('DB unavailable → returning empty result:', err);
      return { command: '', rowCount: 0, oid: 0, fields: [], rows: [] } as QueryResult<T>;
    }
    throw err;
  }
};
