import { Client } from 'pg';
import { e2eDatabaseUrl } from './e2e-database-url';

/** Direct SQL access for the proof tests — including writes that deliberately bypass the app. */
export class E2eDb {
  private constructor(private readonly client: Client) {}

  static async connect(): Promise<E2eDb> {
    const client = new Client({ connectionString: e2eDatabaseUrl() });
    await client.connect();
    return new E2eDb(client);
  }

  query<T = Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
    return this.client.query<T>(sql, values);
  }

  async truncate(): Promise<void> {
    await this.query(
      'TRUNCATE rental_items, rentals, payments, dresses, qr_links, staff_users RESTART IDENTITY CASCADE',
    );
  }

  /** Seeds one dress straight into the catalog table and returns its id. */
  async seedDress(code: string, options: { retired?: boolean } = {}): Promise<string> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO dresses (id, code, name, size_label, rental_price, deposit_amount, status, photo_urls)
       VALUES (gen_random_uuid(), $1, $2, 'M', 1500000, 3000000, $3, '{}')
       RETURNING id`,
      [code, `Váy ${code}`, options.retired ? 'retired' : 'active'],
    );
    const inserted = result.rows[0];
    if (!inserted) throw new Error(`seedDress(${code}) inserted no row`);
    return inserted.id;
  }

  async seedStaff(username: string, role: 'owner' | 'staff', passwordHash: string): Promise<void> {
    await this.query(
      `INSERT INTO staff_users (id, username, name, role, password_hash)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [username, `Nhân sự ${role}`, role, passwordHash],
    );
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
