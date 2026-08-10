import { Client } from 'pg';
import { E2eContext, rentalBody, startE2eApp } from './e2e-app';
import { e2eDatabaseUrl } from './e2e-database-url';
import { addDays, shopToday } from '../src/libs/utils/date';

/**
 * FR-PAY-02 provider proof (docs/design/payments/record-collection.md §5). The rule that earns a
 * real-Postgres test is R3: "one deposit and one rental fee per rental" is only true if the DB
 * says so — the application pre-check cannot see a request that is already in flight.
 */
describe('recording money collected (real Postgres)', () => {
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

  async function openRental(dressCodes: string[]): Promise<string> {
    const dressIds = await Promise.all(dressCodes.map((code) => context.db.seedDress(code)));
    const today = shopToday();
    const created = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody(dressIds, today, addDays(today, 2)),
      token: context.token,
    });
    expect(created.status).toBe(201);
    return (created.body as { id: string }).id;
  }

  function collect(
    rentalId: string,
    body: Record<string, unknown>,
    token: string = context.token,
  ) {
    return context.request(`/api/v1/rentals/${rentalId}/payments/collect`, {
      method: 'POST',
      body,
      token,
    });
  }

  async function ledgerOf(rentalId: string): Promise<{
    data: Array<{ kind: string; amount: number; note: string | null }>;
    summary: Record<string, number>;
  }> {
    const response = await context.request(`/api/v1/rentals/${rentalId}/payments`, {
      token: context.token,
    });
    expect(response.status).toBe(200);
    return response.body as {
      data: Array<{ kind: string; amount: number; note: string | null }>;
      summary: Record<string, number>;
    };
  }

  it('AC1: deposit + rental fee land as two rows with the note, and the summary totals them', async () => {
    const rentalId = await openRental(['PC-001']);

    const response = await collect(rentalId, {
      deposit: 3_000_000,
      rentalFee: 1_500_000,
      note: 'Khách đưa tiền mặt',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: rentalId });

    const ledger = await ledgerOf(rentalId);
    expect(ledger.data.map((row) => [row.kind, row.amount, row.note])).toEqual([
      ['deposit', 3_000_000, 'Khách đưa tiền mặt'],
      ['rental_fee', 1_500_000, 'Khách đưa tiền mặt'],
    ]);
    expect(ledger.summary).toEqual({
      deposit: 3_000_000,
      rentalFee: 1_500_000,
      depositRefund: 0,
      lateFee: 0,
      damageFee: 0,
    });
  });

  it('AC1: staff (not only the owner) may record money — it is counter work', async () => {
    const rentalId = await openRental(['PC-002']);

    const response = await collect(rentalId, { deposit: 3_000_000 }, context.staffToken);

    expect(response.status).toBe(200);
    expect((await ledgerOf(rentalId)).summary.deposit).toBe(3_000_000);
  });

  it('AC2: a second deposit is refused with the amount on file, and the ledger keeps one row', async () => {
    const rentalId = await openRental(['PC-003']);
    expect((await collect(rentalId, { deposit: 3_000_000 })).status).toBe(200);

    const second = await collect(rentalId, { deposit: 500_000 });

    expect(second.status).toBe(422);
    expect(second.body).toEqual({
      status: 'rejected_deposit_already_recorded',
      recordedAmount: 3_000_000,
    });
    const ledger = await ledgerOf(rentalId);
    expect(ledger.data).toHaveLength(1);
    expect(ledger.summary.deposit).toBe(3_000_000);
  });

  it('AC2: the DB, not the app, is what stops a double recording — concurrent calls leave ONE row', async () => {
    const rentalId = await openRental(['PC-004']);

    // Both requests read an empty ledger before either writes: only the partial UNIQUE index can
    // decide this one. Same shape as the rentals overlap race proof.
    const responses = await Promise.all([
      collect(rentalId, { deposit: 3_000_000 }),
      collect(rentalId, { deposit: 3_000_000 }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 422]);
    const refused = responses.find((response) => response.status === 422)!;
    expect((refused.body as { status: string }).status).toBe('rejected_deposit_already_recorded');

    const rows = await context.db.query<{ count: string }>(
      "SELECT count(*) AS count FROM payments WHERE rental_id = $1 AND kind = 'deposit'",
      [rentalId],
    );
    expect(rows.rows[0]!.count).toBe('1');
  });

  it('AC2: the index refuses a raw INSERT that bypasses the app entirely', async () => {
    const rentalId = await openRental(['PC-005']);
    expect((await collect(rentalId, { rentalFee: 1_500_000 })).status).toBe(200);

    await expect(
      context.db.query(
        `INSERT INTO payments (id, rental_id, kind, amount)
         VALUES (gen_random_uuid(), $1, 'rental_fee', 999)`,
        [rentalId],
      ),
    ).rejects.toThrow(/payments_one_rental_fee_per_rental/);
  });

  it('AC2: a settlement may still write several movements — the index is kind-scoped', async () => {
    const rentalId = await openRental(['PC-006']);
    expect((await collect(rentalId, { deposit: 3_000_000 })).status).toBe(200);

    const returned = await context.request(`/api/v1/rentals/${rentalId}/return`, {
      method: 'POST',
      body: { damageFee: 200_000, depositRefund: 2_800_000 },
      token: context.token,
    });

    expect(returned.status).toBe(200);
    const ledger = await ledgerOf(rentalId);
    expect(ledger.summary).toMatchObject({
      deposit: 3_000_000,
      depositRefund: 2_800_000,
      damageFee: 200_000,
    });
  });

  it('AC3: a return that commits DURING the write still takes no money (row lock, not a pre-check)', async () => {
    const rentalId = await openRental(['PC-012']);

    // A second connection holds an uncommitted "the rental was returned" write. The collect
    // request must BLOCK on the rentals row rather than read the stale `out` status and insert
    // against a rental that is about to be closed.
    const blocker = new Client({ connectionString: e2eDatabaseUrl() });
    await blocker.connect();
    let response;
    try {
      await blocker.query('BEGIN');
      await blocker.query("UPDATE rentals SET status = 'returned' WHERE id = $1", [rentalId]);

      const pending = collect(rentalId, { deposit: 3_000_000 });
      // Long enough for the request to reach the lock; the assertion below is what proves it did.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await blocker.query('COMMIT');
      response = await pending;
    } finally {
      await blocker.end();
    }

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      status: 'rejected_rental_closed',
      currentStatus: 'returned',
    });
    const rows = await context.db.query<{ count: string }>(
      'SELECT count(*) AS count FROM payments WHERE rental_id = $1',
      [rentalId],
    );
    expect(rows.rows[0]!.count).toBe('0');
  });

  it('AC3: a returned rental takes no more money', async () => {
    const rentalId = await openRental(['PC-007']);
    expect(
      (
        await context.request(`/api/v1/rentals/${rentalId}/return`, {
          method: 'POST',
          body: {},
          token: context.token,
        })
      ).status,
    ).toBe(200);

    const response = await collect(rentalId, { deposit: 3_000_000 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      status: 'rejected_rental_closed',
      currentStatus: 'returned',
    });
    expect((await ledgerOf(rentalId)).summary.deposit).toBe(0);
  });

  it('AC3: a cancelled rental takes no money either', async () => {
    const rentalId = await openRental(['PC-008']);
    expect(
      (
        await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
          method: 'POST',
          token: context.token,
        })
      ).status,
    ).toBe(200);

    const response = await collect(rentalId, { rentalFee: 1_500_000 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      status: 'rejected_rental_closed',
      currentStatus: 'cancelled',
    });
  });

  it('FR-PAY-02: a settlement whose deposit basis moved is refused, and nothing is written', async () => {
    const rentalId = await openRental(['PC-013']);
    expect((await collect(rentalId, { deposit: 2_000_000 })).status).toBe(200);

    // The client computed its refund believing NO deposit was on file (the catalog fallback), but
    // 2.000.000 has since been recorded. The check runs in the same transaction as the status flip,
    // under the rental's row lock, so it cannot be raced past.
    const settled = await context.request(`/api/v1/rentals/${rentalId}/return`, {
      method: 'POST',
      body: { depositRefund: 3_000_000, expectedDepositCollected: 0 },
      token: context.token,
    });

    expect(settled.status).toBe(422);
    expect(settled.body).toEqual({
      status: 'rejected_deposit_basis_changed',
      collectedDeposit: 2_000_000,
    });

    // The rental is untouched and no refund row exists: a refused settlement writes NOTHING.
    const rows = await context.db.query<{ status: string }>(
      'SELECT status FROM rentals WHERE id = $1',
      [rentalId],
    );
    expect(rows.rows[0]!.status).toBe('out'); // born-out (FR-RENT-10), never flipped to returned
    expect((await ledgerOf(rentalId)).summary.depositRefund).toBe(0);
  });

  it('FR-PAY-02: a settlement whose basis still matches goes through', async () => {
    const rentalId = await openRental(['PC-014']);
    expect((await collect(rentalId, { deposit: 2_000_000 })).status).toBe(200);

    const settled = await context.request(`/api/v1/rentals/${rentalId}/return`, {
      method: 'POST',
      body: { depositRefund: 2_000_000, expectedDepositCollected: 2_000_000 },
      token: context.token,
    });

    expect(settled.status).toBe(200);
    expect((await ledgerOf(rentalId)).summary.depositRefund).toBe(2_000_000);
  });

  it('AC4: an empty recording is a 422 outcome, not a 500 and not an empty write', async () => {
    const rentalId = await openRental(['PC-009']);

    const response = await collect(rentalId, {});

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ status: 'rejected_nothing_to_record' });
    expect((await ledgerOf(rentalId)).data).toEqual([]);
  });

  it('a 0₫ amount is a SHAPE error (400 envelope), not a business outcome', async () => {
    const rentalId = await openRental(['PC-010']);

    const response = await collect(rentalId, { deposit: 0 });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: expect.any(String) } });
  });

  it('an unknown rental is an outcome (422), while the READ of one stays a 404 envelope', async () => {
    const unknownId = '00000000-0000-4000-8000-0000000009ff';

    const write = await collect(unknownId, { deposit: 3_000_000 });
    expect(write.status).toBe(422);
    expect(write.body).toEqual({ status: 'rejected_rental_not_found' });

    const read = await context.request(`/api/v1/rentals/${unknownId}/payments`, {
      token: context.token,
    });
    expect(read.status).toBe(404);
    expect(read.body).toMatchObject({ error: { code: expect.any(String) } });
  });

  it('recording money without a token is a 401 — the guard, not an outcome', async () => {
    const rentalId = await openRental(['PC-011']);

    const response = await collect(rentalId, { deposit: 3_000_000 }, null as unknown as string);

    expect(response.status).toBe(401);
  });
});
