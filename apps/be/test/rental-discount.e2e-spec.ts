import { E2eContext, rentalBody, startE2eApp } from './e2e-app';

interface RentalListRow {
  rentalId: string;
  discountAmount: number;
  dresses: { agreedPrice: number }[];
}

/**
 * FR-RENT-11 proofs (docs/design/rentals-aggregate.md): the discount is stored on the rental,
 * read back by the list, refused above the item total by the aggregate, and refused below zero by
 * the schema even when the application is bypassed.
 */
describe('rentals discount (real Postgres)', () => {
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

  it('a discount is stored on the rental and the list reads it back next to the agreed prices', async () => {
    const dressId = await context.db.seedDress('DSC-001'); // seeded rental price 1.500.000

    const created = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: { ...rentalBody([dressId], '2027-01-10', '2027-01-12'), discountAmount: 200_000 },
      token: context.token,
    });
    expect(created.status).toBe(201);
    const rentalId = (created.body as { id: string }).id;

    const stored = await context.db.query<{ discount_amount: number }>(
      'SELECT discount_amount FROM rentals WHERE id = $1',
      [rentalId],
    );
    expect(stored.rows[0]!.discount_amount).toBe(200_000);

    const list = await context.request('/api/v1/rentals', { token: context.token });
    expect(list.status).toBe(200);
    const row = (list.body as { data: RentalListRow[] }).data.find(
      (item) => item.rentalId === rentalId,
    )!;
    expect(row.discountAmount).toBe(200_000);
    expect(row.dresses[0]!.agreedPrice).toBe(1_500_000); // the item price is NOT reduced
  });

  it('omitting the discount stores zero', async () => {
    const dressId = await context.db.seedDress('DSC-002');

    const created = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], '2027-02-10', '2027-02-12'),
      token: context.token,
    });
    expect(created.status).toBe(201);

    const list = await context.request('/api/v1/rentals', { token: context.token });
    expect((list.body as { data: RentalListRow[] }).data[0]!.discountAmount).toBe(0);
  });

  it('a discount above the sum of the item prices is a 400 envelope and books nothing', async () => {
    const dressId = await context.db.seedDress('DSC-003');

    const refused = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: { ...rentalBody([dressId], '2027-03-10', '2027-03-12'), discountAmount: 1_500_001 },
      token: context.token,
    });
    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject({ error: { code: 'GENERIC.ARGUMENT_INVALID' } });

    const count = await context.db.query<{ count: string }>(
      'SELECT count(*) AS count FROM rentals',
    );
    expect(count.rows[0]!.count).toBe('0');
  });

  it('a negative discount is a 400 validation envelope', async () => {
    const dressId = await context.db.seedDress('DSC-004');

    const refused = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: { ...rentalBody([dressId], '2027-04-10', '2027-04-12'), discountAmount: -1 },
      token: context.token,
    });
    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject({ error: { code: 'GENERIC.VALIDATION' } });
  });

  it('the DB refuses a negative discount when the application is bypassed', async () => {
    const dressId = await context.db.seedDress('DSC-005');
    const created = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], '2027-05-10', '2027-05-12'),
      token: context.token,
    });
    const rentalId = (created.body as { id: string }).id;

    await expect(
      context.db.query('UPDATE rentals SET discount_amount = -1 WHERE id = $1', [rentalId]),
    ).rejects.toThrow(/discount_amount|check/i);
  });
});
