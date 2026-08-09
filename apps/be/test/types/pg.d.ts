/**
 * Minimal ambient types for the `pg` client the e2e suite uses for raw SQL (pg is a real
 * dependency — node-pg-migrate needs it — but ships no types and @types/pg is not installed).
 * Slonik cannot be used here: it is ESM-only and jest runs this suite as CommonJS.
 */
declare module 'pg' {
  export interface QueryResult<T = Record<string, unknown>> {
    rows: T[];
    rowCount: number | null;
  }

  export class Client {
    constructor(config: { connectionString: string });
    connect(): Promise<void>;
    query<T = Record<string, unknown>>(
      sql: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}
