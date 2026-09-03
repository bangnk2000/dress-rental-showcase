import { E2eContext, startE2eApp } from './e2e-app';

/**
 * FR-CAT-08 proofs (docs/design/catalog-aggregate.md): duplicate numbering `<code>_<n>` from 1 is
 * computed against the real table, survives the concurrent race through the UNIQUE index + retry,
 * and the copy gets its own price-history v1 row in the same transaction (FR-CAT-06).
 */
describe('catalog duplicate-dress (real Postgres)', () => {
  let context: E2eContext;

  beforeAll(async () => {
    context = await startE2eApp();
  }, 60_000);

  afterAll(async () => {
    await context.close();
  });

  beforeEach(async () => {
    await context.reset();
  });

  const duplicate = (
    dressId: string,
    body: Record<string, unknown> = {},
    token: string | undefined = undefined,
  ) =>
    context.request(`/api/v1/dresses/${dressId}/duplicate`, {
      method: 'POST',
      body,
      token: token ?? context.token,
    });

  it('numbers copies _1, _2, … and a copy of a copy continues the ORIGINAL sequence', async () => {
    const sourceId = await context.db.seedDress('DUP-001');

    const first = await duplicate(sourceId);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ code: 'DUP-001_1' });

    const second = await duplicate(sourceId);
    expect(second.body).toMatchObject({ code: 'DUP-001_2' });

    const ofCopy = await duplicate((first.body as { id: string }).id);
    expect(ofCopy.body).toMatchObject({ code: 'DUP-001_3' });

    const codes = await context.db.query<{ code: string }>(
      "SELECT code FROM dresses WHERE code LIKE 'DUP-001%' ORDER BY code",
    );
    expect(codes.rows.map((row) => row.code)).toEqual([
      'DUP-001',
      'DUP-001_1',
      'DUP-001_2',
      'DUP-001_3',
    ]);
  });

  it('the copy carries the source fields, the requested size, and its own price-history v1 row', async () => {
    const sourceId = await context.db.seedDress('DUP-002'); // size M, 1.500.000 / 3.000.000

    const copy = await duplicate(sourceId, { sizeLabel: 'L' });
    expect(copy.status).toBe(201);
    const copyId = (copy.body as { id: string }).id;

    const read = await context.request(`/api/v1/dresses/${copyId}`, { token: context.token });
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({
      code: 'DUP-002_1',
      name: 'Váy DUP-002',
      sizeLabel: 'L',
      rentalPrice: 1_500_000,
      depositAmount: 3_000_000,
      status: 'active',
    });

    const history = await context.db.query<{ count: string }>(
      'SELECT count(*) AS count FROM dress_price_history WHERE dress_id = $1',
      [copyId],
    );
    expect(history.rows[0]!.count).toBe('1');
  });

  it('two concurrent duplicates of one dress both succeed with DISTINCT codes', async () => {
    // Both count the same `_n`; the UNIQUE index refuses one, which recounts and takes the next.
    const sourceId = await context.db.seedDress('DUP-003');

    const responses = await Promise.all([duplicate(sourceId), duplicate(sourceId)]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    const codes = responses.map((response) => (response.body as { code: string }).code).sort();
    expect(codes).toEqual(['DUP-003_1', 'DUP-003_2']);
  });

  it('staff may duplicate (a duplicate is a create); an unknown source is the named rejection', async () => {
    const sourceId = await context.db.seedDress('DUP-004');

    const byStaff = await duplicate(sourceId, {}, context.staffToken);
    expect(byStaff.status).toBe(201);

    const unknown = await duplicate('00000000-0000-4000-8000-0000000000ff');
    expect(unknown.status).toBe(422);
    expect(unknown.body).toEqual({ status: 'rejected_dress_not_found' });
  });

  it('a code with an underscore is now accepted by create and read back uppercased', async () => {
    const created = await context.request('/api/v1/dresses', {
      method: 'POST',
      body: { code: 'dup-005_7', name: 'Nhập tay', rentalPrice: 1, depositAmount: 1 },
      token: context.token,
    });
    expect(created.status).toBe(201);

    const read = await context.request(
      `/api/v1/dresses/${(created.body as { id: string }).id}`,
      { token: context.token },
    );
    expect(read.body).toMatchObject({ code: 'DUP-005_7' });
  });
});
