import { E2eDb } from './e2e-db';

/**
 * catalog/listing-styles: the upgrade rewrites EXISTING rows, which a fresh e2e schema never has.
 * So this spec replays the two real migrations inside a scratch schema (search_path puts it in
 * front of public, so `dresses` still resolves): the old table is built by 1755500000000, legacy
 * occasion rows are seeded, then 1755600000000 runs up and down against them.
 */
type Step = (pgm: { sql: (sql: string) => void }) => void;
type Migration = { up: Step; down: Step };

// eslint-disable-next-line @typescript-eslint/no-var-requires -- node-pg-migrate files are CommonJS JS
const listings = require('../migrations/1755500000000_dress_listings.js') as Migration;
// eslint-disable-next-line @typescript-eslint/no-var-requires -- node-pg-migrate files are CommonJS JS
const styles = require('../migrations/1755600000000_listing_styles.js') as Migration;

const SCHEMA = 'listing_styles_migration';

describe('catalog/listing-styles migration on legacy rows (real Postgres)', () => {
  let db: E2eDb;

  const apply = async (step: Step) => {
    const statements: string[] = [];
    step({ sql: (sql) => statements.push(sql) });
    for (const sql of statements) await db.query(sql);
  };
  const values = async (column: 'styles' | 'occasions') =>
    (
      await db.query<{ slug: string; v: string[] }>(`SELECT slug, ${column} AS v FROM dress_listings ORDER BY slug`)
    ).rows.map((row) => [row.slug, [...row.v].sort()]);

  beforeAll(async () => {
    db = await E2eDb.connect();
    await db.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await db.query(`CREATE SCHEMA ${SCHEMA}`);
    await db.query(`SET search_path TO ${SCHEMA}, public`);
    await apply(listings.up);
    await db.query(
      `INSERT INTO dress_listings (id, slug, name, occasions, occasions_text) VALUES
         (gen_random_uuid(), 'a-ao-dai', 'x', '{ao-dai}', 'Lễ Tết'),
         (gen_random_uuid(), 'b-mixed', 'x', '{ao-dai,yearbook}', NULL),
         (gen_random_uuid(), 'c-many', 'x', '{gala,birthday,tea-party}', NULL),
         (gen_random_uuid(), 'd-wedding', 'x', '{wedding-guest}', NULL)`,
    );
  });

  afterAll(async () => {
    await db.query('SET search_path TO public');
    await db.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await db.close();
  });

  it('up: ao-dai kept, every other old code → silk (deduplicated), text column renamed; new CHECK holds', async () => {
    await apply(styles.up);

    expect(await values('styles')).toEqual([
      ['a-ao-dai', ['ao-dai']],
      ['b-mixed', ['ao-dai', 'silk']],
      ['c-many', ['silk']],
      ['d-wedding', ['silk']],
    ]);
    const text = await db.query<{ styles_text: string }>(`SELECT styles_text FROM dress_listings WHERE slug = 'a-ao-dai'`);
    expect(text.rows[0]?.styles_text).toBe('Lễ Tết');

    await expect(db.query(`UPDATE dress_listings SET styles = '{gala}' WHERE slug = 'a-ao-dai'`)).rejects.toThrow(
      /dress_listings_styles_check/,
    );
    await expect(db.query(`UPDATE dress_listings SET styles = '{}' WHERE slug = 'a-ao-dai'`)).rejects.toThrow(
      /dress_listings_styles_check/,
    );
    await db.query(`UPDATE dress_listings SET styles = '{strappy-strapless,sleeved}' WHERE slug = 'd-wedding'`);
  });

  it('down: columns and the old CHECK come back; ao-dai kept, every other style → gala', async () => {
    await apply(styles.down);

    expect(await values('occasions')).toEqual([
      ['a-ao-dai', ['ao-dai']],
      ['b-mixed', ['ao-dai', 'gala']],
      ['c-many', ['gala']],
      ['d-wedding', ['gala']],
    ]);
    await expect(db.query(`UPDATE dress_listings SET occasions = '{silk}' WHERE slug = 'a-ao-dai'`)).rejects.toThrow(
      /dress_listings_occasions_check/,
    );
  });
});
