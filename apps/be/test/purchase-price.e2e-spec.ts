import { E2eContext, startE2eApp } from './e2e-app';

/**
 * catalog/purchase-price (docs/design/catalog/purchase-price.md): the repo's FIRST field-level
 * authorization — staff writes carrying the field are refused BY NAME, staff reads miss the KEY
 * entirely, and the CHECK constraint is the last net.
 */
describe('dress purchase price (real Postgres)', () => {
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

  it('AC1: owner writes; a staff request CARRYING the field is refused and changes nothing', async () => {
    const dressId = await context.db.seedDress('PP-001');

    const ownerSet = await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { purchasePrice: 8_000_000 },
      token: context.token,
    });
    expect(ownerSet.status).toBe(200);

    const staffSet = await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { purchasePrice: 1 },
      token: context.staffToken,
    });
    expect(staffSet.status).toBe(403);
    expect(staffSet.body).toEqual({ status: 'forbidden', reason: 'purchase_price_owner_only' });

    const row = await context.db.query<{ purchase_price: number }>(
      'SELECT purchase_price FROM dresses WHERE id = $1',
      [dressId],
    );
    expect(row.rows[0]!.purchase_price).toBe(8_000_000); // untouched by the refused write

    // Staff editing WITHOUT the field keeps working — the rule is about presence, not the actor.
    const staffRename = await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { name: 'Váy staff sửa tên' },
      token: context.staffToken,
    });
    expect(staffRename.status).toBe(200);
  });

  it('a staff CREATE carrying the field is refused the same way', async () => {
    const response = await context.request('/api/v1/dresses', {
      method: 'POST',
      body: {
        code: 'PP-002',
        name: 'Váy staff tạo',
        rentalPrice: 1_000_000,
        depositAmount: 2_000_000,
        purchasePrice: 5_000_000,
      },
      token: context.staffToken,
    });
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ status: 'forbidden', reason: 'purchase_price_owner_only' });
  });

  it('AC2: the KEY exists only for the owner — absent for staff, null when never entered', async () => {
    const dressId = await context.db.seedDress('PP-003');
    await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { purchasePrice: 8_000_000 },
      token: context.token,
    });

    const ownerDetail = await context.request(`/api/v1/dresses/${dressId}`, {
      token: context.token,
    });
    expect((ownerDetail.body as Record<string, unknown>).purchasePrice).toBe(8_000_000);

    const staffDetail = await context.request(`/api/v1/dresses/${dressId}`, {
      token: context.staffToken,
    });
    expect('purchasePrice' in (staffDetail.body as Record<string, unknown>)).toBe(false);

    const staffList = await context.request('/api/v1/dresses', { token: context.staffToken });
    for (const dress of (staffList.body as { data: Record<string, unknown>[] }).data) {
      expect('purchasePrice' in dress).toBe(false);
    }
    const ownerList = await context.request('/api/v1/dresses', { token: context.token });
    expect(
      (ownerList.body as { data: Record<string, unknown>[] }).data.some(
        (dress) => dress.purchasePrice === 8_000_000,
      ),
    ).toBe(true);

    // Never entered: the owner sees NULL (a different sentence than staff's absence).
    const fresh = await context.db.seedDress('PP-004');
    const freshDetail = await context.request(`/api/v1/dresses/${fresh}`, {
      token: context.token,
    });
    expect((freshDetail.body as Record<string, unknown>).purchasePrice).toBeNull();
  });

  it('the CHECK constraint refuses a negative value even via raw SQL', async () => {
    const dressId = await context.db.seedDress('PP-005');
    await expect(
      context.db.query('UPDATE dresses SET purchase_price = -1 WHERE id = $1', [dressId]),
    ).rejects.toThrow(/check|purchase_price/i);
  });
});
