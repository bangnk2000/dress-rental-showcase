import { E2eContext, startE2eApp } from './e2e-app';

/**
 * catalog invariant proofs (docs/design/catalog-aggregate.md): the unique dress code and the status
 * CHECK live in the schema, and the API surfaces them as NAMED outcomes rather than one generic
 * conflict (ADR 0001 §3).
 */
describe('catalog invariants (real Postgres)', () => {
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

  const dressBody = (code: string): Record<string, unknown> => ({
    code,
    name: `Váy ${code}`,
    sizeLabel: 'M',
    rentalPrice: 1_500_000,
    depositAmount: 3_000_000,
  });

  it('a duplicate code is rejected with rejected_dress_code_taken and names the code', async () => {
    const created = await context.request('/api/v1/dresses', {
      method: 'POST',
      body: dressBody('VD-100'),
      token: context.token,
    });
    expect(created.status).toBe(201);

    const duplicate = await context.request('/api/v1/dresses', {
      method: 'POST',
      body: dressBody('vd-100'),
      token: context.token,
    });

    expect(duplicate.status).toBe(422);
    expect(duplicate.body).toEqual({ status: 'rejected_dress_code_taken', dressCode: 'VD-100' });
  });

  it('two concurrent creates of the same code: one wins, the other gets the SAME named outcome', async () => {
    // Both requests pass the uniqueness pre-check before either inserts, so only the UNIQUE index
    // can decide this. The loser must be indistinguishable from a pre-check rejection — a generic
    // 409 envelope here would leave the form without its field error (ADR 0001 §2).
    const responses = await Promise.all([
      context.request('/api/v1/dresses', {
        method: 'POST',
        body: dressBody('VD-150'),
        token: context.token,
      }),
      context.request('/api/v1/dresses', {
        method: 'POST',
        body: dressBody('VD-150'),
        token: context.token,
      }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 422]);
    const refused = responses.find((response) => response.status === 422)!;
    expect(refused.body).toEqual({ status: 'rejected_dress_code_taken', dressCode: 'VD-150' });

    const rows = await context.db.query<{ count: string }>(
      'SELECT count(*) AS count FROM dresses WHERE code = $1',
      ['VD-150'],
    );
    expect(rows.rows[0]!.count).toBe('1');
  });

  it('the DB refuses a duplicate code when the application is bypassed', async () => {
    await context.db.seedDress('VD-200');

    await expect(context.db.seedDress('VD-200')).rejects.toThrow(/code|unique/i);
  });

  it('the DB refuses a status outside active|retired', async () => {
    const dressId = await context.db.seedDress('VD-300');

    await expect(
      context.db.query('UPDATE dresses SET status = $1 WHERE id = $2', ['lost', dressId]),
    ).rejects.toThrow(/status|check/i);
  });

  it('retiring twice is the named rejection; an unknown dress has its own code', async () => {
    const dressId = await context.db.seedDress('VD-400');

    const first = await context.request(`/api/v1/dresses/${dressId}/retire`, {
      method: 'POST',
      token: context.token,
    });
    expect(first.status).toBe(200);

    const again = await context.request(`/api/v1/dresses/${dressId}/retire`, {
      method: 'POST',
      token: context.token,
    });
    expect(again.status).toBe(422);
    expect(again.body).toEqual({ status: 'rejected_dress_already_retired' });

    const unknown = await context.request(
      '/api/v1/dresses/00000000-0000-4000-8000-0000000000ff/retire',
      { method: 'POST', token: context.token },
    );
    expect(unknown.status).toBe(422);
    expect(unknown.body).toEqual({ status: 'rejected_dress_not_found' });
  });

  it('a READ that finds nothing stays the 404 fault envelope', async () => {
    const response = await context.request(
      '/api/v1/dresses/00000000-0000-4000-8000-0000000000ff',
      { token: context.token },
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'GENERIC.NOT_FOUND' } });
  });

  it('an invalid price is the 400 validation envelope with field details', async () => {
    const response = await context.request('/api/v1/dresses', {
      method: 'POST',
      body: { ...dressBody('VD-500'), rentalPrice: -1 },
      token: context.token,
    });

    expect(response.status).toBe(400);
    const body = response.body as { error: { code: string; details?: unknown[] } };
    expect(body.error.code).toBe('GENERIC.VALIDATION');
    expect(body.error.details?.length).toBeGreaterThan(0);
  });
});
