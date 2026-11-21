import { E2eContext, rentalBody, startE2eApp } from './e2e-app';

function shopToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function shiftDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * FR-RENT-14 (docs/design/rentals/deposit-at-pickup.md): money handed over at booking is written in
 * the SAME transaction as the rental; a booking is handed out only with a deposit on file or
 * collected at the counter, judged under the rental's row lock.
 */
describe('deposit at booking and pickup (real Postgres)', () => {
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

  async function book(
    code: string,
    collect?: { deposit?: number; rentalFee?: number },
    startOffset = 10,
  ): Promise<{ rentalId: string; dressId: string; status: number; body: unknown }> {
    const today = shopToday();
    const dressId = await context.db.seedDress(code);
    const response = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: {
        ...rentalBody([dressId], shiftDays(today, startOffset), shiftDays(today, startOffset + 2)),
        ...(collect ? { collect } : {}),
      },
      token: context.token,
    });
    return {
      rentalId: (response.body as { id?: string }).id ?? '',
      dressId,
      status: response.status,
      body: response.body,
    };
  }

  async function ledger(rentalId: string): Promise<[string, number][]> {
    const rows = await context.db.query<{ kind: string; amount: number }>(
      'SELECT kind, amount FROM payments WHERE rental_id = $1 ORDER BY kind',
      [rentalId],
    );
    return rows.rows.map((row) => [row.kind, row.amount]);
  }

  async function statusOf(rentalId: string): Promise<string> {
    const row = await context.db.query<{ status: string }>(
      'SELECT status FROM rentals WHERE id = $1',
      [rentalId],
    );
    return row.rows[0]!.status;
  }

  const pickup = (rentalId: string, body?: unknown) =>
    context.request(`/api/v1/rentals/${rentalId}/pickup`, {
      method: 'POST',
      ...(body ? { body } : {}),
      token: context.token,
    });

  it('create with collect: deposit + rental fee land with the rental', async () => {
    const { rentalId, status } = await book('E2E-DP01', { deposit: 3_000_000, rentalFee: 1_500_000 });

    expect(status).toBe(201);
    expect(await ledger(rentalId)).toEqual([
      ['deposit', 3_000_000],
      ['rental_fee', 1_500_000],
    ]);
  });

  it('create with only the rental fee (Q1/Q2): no deposit row', async () => {
    const { rentalId } = await book('E2E-DP02', { rentalFee: 1_500_000 });
    expect(await ledger(rentalId)).toEqual([['rental_fee', 1_500_000]]);
  });

  it('a 0₫ collect amount is a SHAPE error (400), and nothing is created', async () => {
    const { status } = await book('E2E-DP03', { deposit: 0 });
    expect(status).toBe(400);
    const rentals = await context.db.query('SELECT count(*)::int AS n FROM rentals');
    expect((rentals.rows[0] as { n: number }).n).toBe(0);
  });

  it('a create that loses the overlap leaves NO orphan payment (one transaction)', async () => {
    const today = shopToday();
    const dressId = await context.db.seedDress('E2E-DP04');
    const body = (name: string) => ({
      ...rentalBody([dressId], shiftDays(today, 10), shiftDays(today, 12)),
      customerName: name,
      collect: { deposit: 3_000_000, rentalFee: 1_500_000 },
    });

    const [first, second] = await Promise.all([
      context.request('/api/v1/rentals', { method: 'POST', body: body('A'), token: context.token }),
      context.request('/api/v1/rentals', { method: 'POST', body: body('B'), token: context.token }),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 422]);
    const payments = await context.db.query<{ rental_id: string }>(
      'SELECT DISTINCT rental_id FROM payments',
    );
    const winner = (first.status === 201 ? first.body : second.body) as { id: string };
    expect(payments.rows.map((row) => row.rental_id)).toEqual([winner.id]);
  });

  it('Q3: a booking with no deposit is NOT handed out without one', async () => {
    const { rentalId } = await book('E2E-DP05', { rentalFee: 1_500_000 });

    const response = await pickup(rentalId);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ status: 'rejected_deposit_not_collected' });
    expect(await statusOf(rentalId)).toBe('booked');
  });

  it('pickup collecting the deposit: out + one deposit row, same transaction', async () => {
    const { rentalId } = await book('E2E-DP06');

    const response = await pickup(rentalId, { depositCollected: 2_500_000 });

    expect(response.status).toBe(200);
    expect(await statusOf(rentalId)).toBe('out');
    expect(await ledger(rentalId)).toEqual([['deposit', 2_500_000]]);
  });

  it('a booking already holding a deposit is handed out with no body, as before', async () => {
    const { rentalId } = await book('E2E-DP07', { deposit: 3_000_000 });

    const response = await pickup(rentalId);

    expect(response.status).toBe(200);
    expect(await ledger(rentalId)).toEqual([['deposit', 3_000_000]]);
  });

  it('a deposit brought while one is on file → already recorded with the amount, nothing moves', async () => {
    const { rentalId } = await book('E2E-DP08', { deposit: 3_000_000 });

    const response = await pickup(rentalId, { depositCollected: 2_000_000 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      status: 'rejected_deposit_already_recorded',
      recordedAmount: 3_000_000,
    });
    expect(await statusOf(rentalId)).toBe('booked');
    expect(await ledger(rentalId)).toEqual([['deposit', 3_000_000]]);
  });

  it('race: a pickup collecting the deposit vs. a collection of the deposit — exactly ONE deposit row', async () => {
    const { rentalId } = await book('E2E-DP09');

    const [handout, collect] = await Promise.all([
      pickup(rentalId, { depositCollected: 3_000_000 }),
      context.request(`/api/v1/rentals/${rentalId}/payments/collect`, {
        method: 'POST',
        body: { deposit: 2_000_000 },
        token: context.token,
      }),
    ]);

    const rows = await ledger(rentalId);
    expect(rows.filter(([kind]) => kind === 'deposit')).toHaveLength(1);
    if (handout.status === 200) {
      // The pickup's deposit landed first; the collection is told what is on file.
      expect(collect.status).toBe(422);
      expect(collect.body).toMatchObject({
        status: 'rejected_deposit_already_recorded',
        recordedAmount: 3_000_000,
      });
      expect(await statusOf(rentalId)).toBe('out');
    } else {
      expect(collect.status).toBe(200);
      expect(handout.body).toEqual({
        status: 'rejected_deposit_already_recorded',
        recordedAmount: 2_000_000,
      });
      expect(await statusOf(rentalId)).toBe('booked');
    }
  });

  it('the board says which bookings still owe a deposit — per rental, even with several dresses', async () => {
    const today = shopToday();
    const [a, b] = [await context.db.seedDress('E2E-DP11'), await context.db.seedDress('E2E-DP12')];
    const start = shiftDays(today, 5);
    const paid = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: { ...rentalBody([a, b], start, shiftDays(today, 6)), collect: { deposit: 6_000_000 } },
      token: context.token,
    });
    const unpaid = await book('E2E-DP13', undefined, 5);

    const board = await context.request(`/api/v1/rentals/today-board?date=${start}`, {
      token: context.token,
    });

    const dueOut = (board.body as { dueOut: { rentalId: string; depositCollected: number }[] })
      .dueOut;
    const byId = new Map(dueOut.map((entry) => [entry.rentalId, entry.depositCollected]));
    expect(byId.get((paid.body as { id: string }).id)).toBe(6_000_000); // not 12M: one per rental
    expect(byId.get(unpaid.rentalId)).toBe(0);
  });

  it('Q5: a born-out create without a deposit is still allowed (the form only warns)', async () => {
    const { rentalId, status } = await book('E2E-DP10', undefined, 0);
    expect(status).toBe(201);
    expect(await statusOf(rentalId)).toBe('out');
  });
});
