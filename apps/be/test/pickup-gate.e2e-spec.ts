import { E2eContext, rentalBody, startE2eApp } from './e2e-app';

/** The shop's calendar day, same rule as the API (Asia/Ho_Chi_Minh). */
function shopToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function shiftDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * FR-RENT-10 (docs/design/rentals/pickup-before-return.md): return only from `out`, same-day and
 * backdated creates are born delivered, and an OUT rental cancels only with an EMPTY ledger
 * (booked + money: test/cancel-with-refund.e2e-spec.ts).
 */
describe('pickup gate (real Postgres)', () => {
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

  async function createRental(start: string, end: string, code: string): Promise<string> {
    const dressId = await context.db.seedDress(code);
    const response = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], start, end),
      token: context.token,
    });
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  async function statusOf(rentalId: string): Promise<string> {
    const row = await context.db.query<{ status: string }>(
      'SELECT status FROM rentals WHERE id = $1',
      [rentalId],
    );
    return row.rows[0]!.status;
  }

  it('AC2: a rental starting TODAY is born delivered', async () => {
    const today = shopToday();
    const rentalId = await createRental(today, shiftDays(today, 1), 'E2E-G01');
    expect(await statusOf(rentalId)).toBe('out');
  });

  it('AC2/§6.Q1: a BACKDATED rental is born delivered; a future one is born booked', async () => {
    const today = shopToday();
    const backdated = await createRental(shiftDays(today, -5), shiftDays(today, -3), 'E2E-G02');
    expect(await statusOf(backdated)).toBe('out');

    const future = await createRental(shiftDays(today, 10), shiftDays(today, 12), 'E2E-G03');
    expect(await statusOf(future)).toBe('booked');
  });

  it('AC1: returning a booked rental is refused by name, flips nothing, writes no money', async () => {
    const today = shopToday();
    const rentalId = await createRental(shiftDays(today, 10), shiftDays(today, 12), 'E2E-G04');

    const settle = await context.request(`/api/v1/rentals/${rentalId}/return`, {
      method: 'POST',
      body: {},
      token: context.token,
    });

    expect(settle.status).toBe(422);
    expect(settle.body).toEqual({ status: 'rejected_return_not_allowed', currentStatus: 'booked' });
    expect(await statusOf(rentalId)).toBe('booked');
    const payments = await context.db.query(
      'SELECT count(*)::int AS n FROM payments WHERE rental_id = $1',
      [rentalId],
    );
    expect((payments.rows[0] as { n: number }).n).toBe(0);
  });

  it('§6.Q2: a born-out rental with an EMPTY ledger cancels and frees the calendar', async () => {
    const today = shopToday();
    const end = shiftDays(today, 1);
    const rentalId = await createRental(today, end, 'E2E-G05');
    expect(await statusOf(rentalId)).toBe('out');

    const cancel = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      token: context.token,
    });
    expect(cancel.status).toBe(200);
    expect(await statusOf(rentalId)).toBe('cancelled');

    // The DB-level proof that the calendar freed: the same dress + dates book again.
    const dressId = (
      await context.db.query<{ dress_id: string }>(
        'SELECT dress_id FROM rental_items WHERE rental_id = $1',
        [rentalId],
      )
    ).rows[0]!.dress_id;
    const rebook = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], today, end),
      token: context.token,
    });
    expect(rebook.status).toBe(201);
  });

  it('§6.Q2: recorded money blocks the cancel with its own outcome — return is the only exit', async () => {
    const today = shopToday();
    const rentalId = await createRental(today, shiftDays(today, 1), 'E2E-G06');

    const collect = await context.request(`/api/v1/rentals/${rentalId}/payments/collect`, {
      method: 'POST',
      body: { deposit: 2_000_000 },
      token: context.token,
    });
    expect(collect.status).toBe(200);

    const cancel = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      token: context.token,
    });
    expect(cancel.status).toBe(422);
    expect(cancel.body).toEqual({ status: 'rejected_cancel_has_payments' });
    expect(await statusOf(rentalId)).toBe('out');
    // The item still blocks: a cancel that was refused must not free the calendar.
    const blocking = await context.db.query<{ blocking: boolean }>(
      'SELECT blocking FROM rental_items WHERE rental_id = $1',
      [rentalId],
    );
    expect(blocking.rows[0]!.blocking).toBe(true);
  });

  // Narrowed 2026-11-07 (rentals/cancel-with-refund): a BOOKED rental with money cancels WITH
  // refunds — a bare cancel (no basis) is told what is on file instead of being refused outright.
  it('a BOOKED rental with a collected deposit and a bare cancel → told the basis, nothing written', async () => {
    const today = shopToday();
    const rentalId = await createRental(shiftDays(today, 10), shiftDays(today, 12), 'E2E-G07');
    expect(await statusOf(rentalId)).toBe('booked');

    const collect = await context.request(`/api/v1/rentals/${rentalId}/payments/collect`, {
      method: 'POST',
      body: { deposit: 1_000_000 },
      token: context.token,
    });
    expect(collect.status).toBe(200);

    const cancel = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      token: context.token,
    });
    expect(cancel.status).toBe(422);
    expect(cancel.body).toEqual({
      status: 'rejected_cancel_basis_changed',
      collectedDeposit: 1_000_000,
      collectedRentalFee: 0,
    });
    expect(await statusOf(rentalId)).toBe('booked');
  });

  it('the normal advance flow is untouched: book future → pickup on the day → return', async () => {
    const today = shopToday();
    const rentalId = await createRental(shiftDays(today, 3), shiftDays(today, 4), 'E2E-G08');

    const pickup = await context.request(`/api/v1/rentals/${rentalId}/pickup`, {
      method: 'POST',
      token: context.token,
    });
    expect(pickup.status).toBe(200);
    expect(await statusOf(rentalId)).toBe('out');

    const settle = await context.request(`/api/v1/rentals/${rentalId}/return`, {
      method: 'POST',
      body: {},
      token: context.token,
    });
    expect(settle.status).toBe(200);
    expect(await statusOf(rentalId)).toBe('returned');
  });
});
