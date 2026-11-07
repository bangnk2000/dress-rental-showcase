import { E2eContext, rentalBody, startE2eApp } from './e2e-app';

type Step = (pgm: { sql: (sql: string) => void }) => void;
type Migration = { up: Step; down: Step };

// eslint-disable-next-line @typescript-eslint/no-var-requires -- node-pg-migrate files are CommonJS JS
const refundKind = require('../migrations/1755800000000_payments_rental_fee_refund.js') as Migration;

function shopToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function shiftDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * rentals/cancel-with-refund (docs/design/rentals/cancel-with-refund.md): a BOOKED rental with money
 * on file cancels WITH refunds written in the same transaction; each refund ≤ collected, the basis
 * is re-read under the row lock, keeping money is owner-only + note; the new kind is a DB CHECK.
 */
describe('cancel with refund (real Postgres)', () => {
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

  /** A future (booked) rental with a deposit of 3M and a rental fee of 1.5M on file. */
  async function prepaidBooking(code: string): Promise<{ rentalId: string; dressId: string }> {
    const today = shopToday();
    const dressId = await context.db.seedDress(code);
    const created = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], shiftDays(today, 10), shiftDays(today, 12)),
      token: context.token,
    });
    expect(created.status).toBe(201);
    const rentalId = (created.body as { id: string }).id;
    const collect = await context.request(`/api/v1/rentals/${rentalId}/payments/collect`, {
      method: 'POST',
      body: { deposit: 3_000_000, rentalFee: 1_500_000 },
      token: context.token,
    });
    expect(collect.status).toBe(200);
    return { rentalId, dressId };
  }

  const BASIS = { expectedDepositCollected: 3_000_000, expectedRentalFeeCollected: 1_500_000 };

  async function statusOf(rentalId: string): Promise<string> {
    const row = await context.db.query<{ status: string }>(
      'SELECT status FROM rentals WHERE id = $1',
      [rentalId],
    );
    return row.rows[0]!.status;
  }

  async function refundsOf(rentalId: string): Promise<[string, number, string | null][]> {
    const rows = await context.db.query<{ kind: string; amount: number; note: string | null }>(
      `SELECT kind, amount, note FROM payments
        WHERE rental_id = $1 AND kind IN ('deposit_refund', 'rental_fee_refund') ORDER BY kind`,
      [rentalId],
    );
    return rows.rows.map((row) => [row.kind, row.amount, row.note]);
  }

  it('staff refunding in full: cancelled, both refund rows, calendar freed', async () => {
    const { rentalId, dressId } = await prepaidBooking('E2E-CR01');

    const cancel = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      body: { ...BASIS, depositRefund: 3_000_000, rentalFeeRefund: 1_500_000 },
      token: context.staffToken,
    });

    expect(cancel.status).toBe(200);
    expect(await statusOf(rentalId)).toBe('cancelled');
    expect(await refundsOf(rentalId)).toEqual([
      ['deposit_refund', 3_000_000, null],
      ['rental_fee_refund', 1_500_000, null],
    ]);
    const summary = await context.request(`/api/v1/rentals/${rentalId}/payments`, {
      token: context.token,
    });
    expect((summary.body as { summary: Record<string, number> }).summary).toMatchObject({
      deposit: 3_000_000,
      rentalFee: 1_500_000,
      depositRefund: 3_000_000,
      rentalFeeRefund: 1_500_000,
    });

    const today = shopToday();
    const rebook = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], shiftDays(today, 10), shiftDays(today, 12)),
      token: context.token,
    });
    expect(rebook.status).toBe(201);
  });

  it('§6.Q3: staff keeping money → 403 forbidden outcome, nothing written', async () => {
    const { rentalId } = await prepaidBooking('E2E-CR02');

    const cancel = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      body: { ...BASIS, depositRefund: 3_000_000, rentalFeeRefund: 1_000_000, note: 'phí huỷ' },
      token: context.staffToken,
    });

    expect(cancel.status).toBe(403);
    expect(cancel.body).toEqual({
      status: 'forbidden',
      reason: 'cancel_retention_requires_owner',
      retainedAmount: 500_000,
    });
    expect(await statusOf(rentalId)).toBe('booked');
    expect(await refundsOf(rentalId)).toEqual([]);
  });

  it('§6.Q3: owner keeping money needs a note; with one, a zero refund writes no row', async () => {
    const { rentalId } = await prepaidBooking('E2E-CR03');
    const body = { ...BASIS, depositRefund: 3_000_000, rentalFeeRefund: 0 };

    const noNote = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      body,
      token: context.token,
    });
    expect(noNote.status).toBe(422);
    expect(noNote.body).toEqual({
      status: 'rejected_retention_note_required',
      retainedAmount: 1_500_000,
    });

    const withNote = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      body: { ...body, note: 'Huỷ sát ngày — giữ tiền thuê' },
      token: context.token,
    });
    expect(withNote.status).toBe(200);
    expect(await refundsOf(rentalId)).toEqual([
      ['deposit_refund', 3_000_000, 'Huỷ sát ngày — giữ tiền thuê'],
    ]);
  });

  it('R2: a refund above what was collected is refused by name', async () => {
    const { rentalId } = await prepaidBooking('E2E-CR04');

    const cancel = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      body: { ...BASIS, depositRefund: 3_000_000, rentalFeeRefund: 1_600_000 },
      token: context.token,
    });

    expect(cancel.status).toBe(422);
    expect(cancel.body).toEqual({
      status: 'rejected_refund_exceeds_collected',
      refundKind: 'rental_fee',
      collected: 1_500_000,
      submitted: 1_600_000,
    });
    expect(await statusOf(rentalId)).toBe('booked');
  });

  it('R3: a stale basis is refused with what IS on file, nothing written', async () => {
    const { rentalId } = await prepaidBooking('E2E-CR05');

    const cancel = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      body: {
        expectedDepositCollected: 2_000_000,
        expectedRentalFeeCollected: 1_500_000,
        depositRefund: 2_000_000,
        rentalFeeRefund: 1_500_000,
      },
      token: context.staffToken,
    });

    expect(cancel.status).toBe(422);
    expect(cancel.body).toEqual({
      status: 'rejected_cancel_basis_changed',
      collectedDeposit: 3_000_000,
      collectedRentalFee: 1_500_000,
    });
    expect(await refundsOf(rentalId)).toEqual([]);
  });

  it('R3 race: a collection and a cancel on the same rental take turns under the row lock', async () => {
    // Booked rental, deposit only on file; the dialog was opened when the fee was not yet paid.
    const today = shopToday();
    const dressId = await context.db.seedDress('E2E-CR06');
    const created = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], shiftDays(today, 10), shiftDays(today, 12)),
      token: context.token,
    });
    const rentalId = (created.body as { id: string }).id;
    await context.request(`/api/v1/rentals/${rentalId}/payments/collect`, {
      method: 'POST',
      body: { deposit: 3_000_000 },
      token: context.token,
    });

    const [collect, cancel] = await Promise.all([
      context.request(`/api/v1/rentals/${rentalId}/payments/collect`, {
        method: 'POST',
        body: { rentalFee: 1_500_000 },
        token: context.token,
      }),
      context.request(`/api/v1/rentals/${rentalId}/cancel`, {
        method: 'POST',
        body: {
          expectedDepositCollected: 3_000_000,
          expectedRentalFeeCollected: 0,
          depositRefund: 3_000_000,
        },
        token: context.token,
      }),
    ]);

    // Exactly one wins; the loser answers with its named outcome — never a money row orphaned
    // on a cancelled rental, never a refund computed from the wrong basis.
    if (cancel.status === 200) {
      expect(collect.status).toBe(422);
      expect(collect.body).toMatchObject({ status: 'rejected_rental_closed' });
      expect(await refundsOf(rentalId)).toEqual([['deposit_refund', 3_000_000, null]]);
    } else {
      expect(collect.status).toBe(200);
      expect(cancel.body).toEqual({
        status: 'rejected_cancel_basis_changed',
        collectedDeposit: 3_000_000,
        collectedRentalFee: 1_500_000,
      });
      expect(await statusOf(rentalId)).toBe('booked');
    }
  });

  it('§6.Q1: an OUT rental with money still refuses the cancel — even with a correct basis', async () => {
    const today = shopToday();
    const dressId = await context.db.seedDress('E2E-CR07');
    const created = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], today, shiftDays(today, 1)),
      token: context.token,
    });
    const rentalId = (created.body as { id: string }).id;
    expect(await statusOf(rentalId)).toBe('out');
    await context.request(`/api/v1/rentals/${rentalId}/payments/collect`, {
      method: 'POST',
      body: { deposit: 3_000_000 },
      token: context.token,
    });

    const cancel = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      body: { expectedDepositCollected: 3_000_000, expectedRentalFeeCollected: 0, depositRefund: 3_000_000 },
      token: context.token,
    });

    expect(cancel.status).toBe(422);
    expect(cancel.body).toEqual({ status: 'rejected_cancel_has_payments' });
    expect(await refundsOf(rentalId)).toEqual([]);
  });

  it('raw SQL: the kind CHECK admits rental_fee_refund and still refuses an unknown kind', async () => {
    const { rentalId } = await prepaidBooking('E2E-CR08');

    await context.db.query(
      `INSERT INTO payments (id, rental_id, kind, amount) VALUES (gen_random_uuid(), $1, 'rental_fee_refund', 1)`,
      [rentalId],
    );
    await expect(
      context.db.query(
        `INSERT INTO payments (id, rental_id, kind, amount) VALUES (gen_random_uuid(), $1, 'cancel_fee', 1)`,
        [rentalId],
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'payments_kind_check' });
  });

  describe('migration 1755800000000', () => {
    const apply = async (step: Step) => {
      const statements: string[] = [];
      step({ sql: (sql) => statements.push(sql) });
      for (const sql of statements) await context.db.query(sql);
    };

    it('down refuses while rental_fee_refund rows exist (money history is never deleted)', async () => {
      const { rentalId } = await prepaidBooking('E2E-CR09');
      await context.db.query(
        `INSERT INTO payments (id, rental_id, kind, amount) VALUES (gen_random_uuid(), $1, 'rental_fee_refund', 1)`,
        [rentalId],
      );
      await context.db.query('BEGIN');
      try {
        await expect(apply(refundKind.down)).rejects.toThrow(/cannot roll back/);
      } finally {
        await context.db.query('ROLLBACK');
      }
    });

    it('down then up on an empty kind: the CHECK refuses, then admits, rental_fee_refund', async () => {
      const { rentalId } = await prepaidBooking('E2E-CR10');
      const insertRefund = () =>
        context.db.query(
          `INSERT INTO payments (id, rental_id, kind, amount) VALUES (gen_random_uuid(), $1, 'rental_fee_refund', 1)`,
          [rentalId],
        );
      await context.db.query('BEGIN');
      try {
        await apply(refundKind.down);
        await context.db.query('SAVEPOINT refused');
        await expect(insertRefund()).rejects.toMatchObject({ code: '23514' });
        await context.db.query('ROLLBACK TO SAVEPOINT refused');
        await apply(refundKind.up);
        await expect(insertRefund()).resolves.toBeDefined();
      } finally {
        await context.db.query('ROLLBACK');
      }
    });
  });
});
