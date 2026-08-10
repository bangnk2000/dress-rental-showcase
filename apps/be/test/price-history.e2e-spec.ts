import { E2eContext, startE2eApp } from './e2e-app';

interface HistoryEntry {
  rentalPrice: number;
  depositAmount: number;
  changedAt: string;
  changedBy: { id: string; name: string } | null;
}

/**
 * catalog/price-history (docs/design/catalog/price-history.md): one row per ACTUAL change,
 * committed in the same transaction as the dress write; every API-created dress starts at v1.
 */
describe('dress price history (real Postgres)', () => {
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

  async function createDress(code: string): Promise<string> {
    const response = await context.request('/api/v1/dresses', {
      method: 'POST',
      body: { code, name: `Váy ${code}`, rentalPrice: 1_000_000, depositAmount: 2_000_000 },
      token: context.token,
    });
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  async function historyOf(dressId: string, token?: string): Promise<HistoryEntry[]> {
    const response = await context.request(`/api/v1/dresses/${dressId}/price-history`, {
      token: token ?? context.token,
    });
    expect(response.status).toBe(200);
    return (response.body as { data: HistoryEntry[] }).data;
  }

  it('AC1/AC4: v1 at create; one row per actual change, newest first, with the changer named', async () => {
    const dressId = await createDress('PH-001');

    let history = await historyOf(dressId);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ rentalPrice: 1_000_000, depositAmount: 2_000_000 });
    expect(history[0]!.changedBy?.name).toBe('Nhân sự owner'); // the harness owner's display name

    const raise = await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { rentalPrice: 1_200_000 },
      token: context.token,
    });
    expect(raise.status).toBe(200);

    history = await historyOf(dressId);
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ rentalPrice: 1_200_000, depositAmount: 2_000_000 });
    expect(history[1]).toMatchObject({ rentalPrice: 1_000_000 });

    // Re-sending the SAME numbers is a no-op for the log…
    await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { rentalPrice: 1_200_000, depositAmount: 2_000_000 },
      token: context.token,
    });
    // …and so is an edit that touches no price at all.
    await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { name: 'Váy đổi tên' },
      token: context.token,
    });
    expect(await historyOf(dressId)).toHaveLength(2);
  });

  it('AC2: the log has no update/delete surface — raw SQL is the only writer besides the app', async () => {
    const dressId = await createDress('PH-002');
    const patch = await context.request(`/api/v1/dresses/${dressId}/price-history`, {
      method: 'PATCH',
      body: {},
      token: context.token,
    });
    const del = await context.request(`/api/v1/dresses/${dressId}/price-history`, {
      method: 'DELETE',
      token: context.token,
    });
    expect([patch.status, del.status]).toEqual([404, 404]); // routes simply do not exist
  });

  it('AC3/§6.Q1: any staff reads the history — prices are shop-public, so is their log', async () => {
    const dressId = await createDress('PH-003');
    const asStaff = await historyOf(dressId, context.staffToken);
    expect(asStaff).toHaveLength(1);
  });

  it('the dress write and its history row commit atomically — a refused write logs nothing', async () => {
    const dressId = await createDress('PH-004');
    await createDress('PH-005');

    // Renaming PH-004's code onto the taken PH-005 fails INSIDE the write path; the price change
    // riding in the same request must not leave a log line behind.
    const refused = await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { code: 'PH-005', rentalPrice: 9_999_999 },
      token: context.token,
    });
    expect(refused.status).toBe(422);
    expect(await historyOf(dressId)).toHaveLength(1);
  });
});
