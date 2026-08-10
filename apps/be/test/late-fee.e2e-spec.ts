import { E2eContext, rentalBody, startE2eApp } from './e2e-app';
import { addDays, shopToday } from '../src/libs/utils/date';

/**
 * FR-RENT-09 provider proof (docs/design/rentals/settle-late-fee.md §5): the fee the API charges,
 * the 403 outcome for a staff waiver, and the note requirement — asserted over real HTTP against a
 * real Postgres, because "the server owns the number" is only true if the wire says so.
 */
describe('late fee at return (real Postgres)', () => {
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

  /** A rental whose return date passed `daysLate` days ago, already handed out. */
  async function overdueRental(
    daysLate: number,
    dressCodes: string[],
  ): Promise<{ rentalId: string; dressIds: string[] }> {
    const today = shopToday();
    const dueDate = addDays(today, -daysLate);
    const dressIds = await Promise.all(dressCodes.map((code) => context.db.seedDress(code)));

    const created = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody(dressIds, addDays(dueDate, -1), dueDate),
      token: context.token,
    });
    expect(created.status).toBe(201);
    const rentalId = (created.body as { id: string }).id;

    const pickup = await context.request(`/api/v1/rentals/${rentalId}/pickup`, {
      method: 'POST',
      token: context.token,
    });
    expect(pickup.status).toBe(200);
    return { rentalId, dressIds };
  }

  async function paymentsOf(rentalId: string): Promise<Array<{ kind: string; amount: number }>> {
    const response = await context.request(`/api/v1/rentals/${rentalId}/payments`, {
      token: context.token,
    });
    return (response.body as { data: Array<{ kind: string; amount: number }> }).data;
  }

  it('AC1: the quote states days late and the suggested fee, per dress', async () => {
    const { rentalId } = await overdueRental(3, ['LF-001', 'LF-002']);

    const quote = await context.request(`/api/v1/rentals/${rentalId}/late-fee`, {
      token: context.token,
    });

    expect(quote.status).toBe(200);
    expect(quote.body).toMatchObject({
      rentalId,
      daysLate: 3,
      dressCount: 2,
      dailyRateAmount: 200_000,
      suggestedLateFee: 1_200_000, // 3 days × 2 dresses × 200.000
      referenceDate: shopToday(),
    });
  });

  it('AC1: a rental returned on time quotes zero', async () => {
    const { rentalId } = await overdueRental(0, ['LF-003']);

    const quote = await context.request(`/api/v1/rentals/${rentalId}/late-fee`, {
      token: context.token,
    });

    expect(quote.body).toMatchObject({ daysLate: 0, suggestedLateFee: 0 });
  });

  it('AC2: omitting lateFee charges the suggested amount', async () => {
    const { rentalId } = await overdueRental(2, ['LF-010']);

    const settle = await context.request(`/api/v1/rentals/${rentalId}/return`, {
      method: 'POST',
      body: { depositRefund: 3_000_000 },
      token: context.token,
    });

    expect(settle.status).toBe(200);
    expect(await paymentsOf(rentalId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'late_fee', amount: 400_000 }),
        expect.objectContaining({ kind: 'deposit_refund', amount: 3_000_000 }),
      ]),
    );
  });

  it('AC3: a STAFF waiver is refused with the named 403 outcome and changes nothing', async () => {
    const { rentalId } = await overdueRental(2, ['LF-020']);

    const settle = await context.request(`/api/v1/rentals/${rentalId}/return`, {
      method: 'POST',
      body: { lateFee: 50_000, note: 'Khách quen' },
      token: context.staffToken,
    });

    expect(settle.status).toBe(403);
    expect(settle.body).toEqual({
      status: 'forbidden',
      reason: 'late_fee_waiver_requires_owner',
      suggestedLateFee: 400_000,
      submittedLateFee: 50_000,
    });
    // still handed out, nothing settled
    const rows = await context.db.query<{ status: string }>(
      'SELECT status FROM rentals WHERE id = $1',
      [rentalId],
    );
    expect(rows.rows[0]?.status).toBe('out');
    expect(await paymentsOf(rentalId)).toEqual([]);
  });

  it('AC3: staff MAY charge the suggested amount, and more', async () => {
    const exact = await overdueRental(1, ['LF-030']);
    const exactSettle = await context.request(`/api/v1/rentals/${exact.rentalId}/return`, {
      method: 'POST',
      body: { lateFee: 200_000 },
      token: context.staffToken,
    });
    expect(exactSettle.status).toBe(200);

    const generous = await overdueRental(1, ['LF-031']);
    const generousSettle = await context.request(`/api/v1/rentals/${generous.rentalId}/return`, {
      method: 'POST',
      body: { lateFee: 500_000, note: 'Khách tự bù thêm' },
      token: context.staffToken,
    });
    expect(generousSettle.status).toBe(200);
    expect(await paymentsOf(generous.rentalId)).toEqual([
      expect.objectContaining({ kind: 'late_fee', amount: 500_000 }),
    ]);
  });

  it('AC3: an OWNER waiver without a reason is refused, with a reason it is recorded', async () => {
    const { rentalId } = await overdueRental(2, ['LF-040']);

    const noReason = await context.request(`/api/v1/rentals/${rentalId}/return`, {
      method: 'POST',
      body: { lateFee: 0 },
      token: context.token,
    });
    expect(noReason.status).toBe(422);
    expect(noReason.body).toEqual({
      status: 'rejected_waiver_note_required',
      suggestedLateFee: 400_000,
      submittedLateFee: 0,
    });

    const withReason = await context.request(`/api/v1/rentals/${rentalId}/return`, {
      method: 'POST',
      body: { lateFee: 100_000, note: 'Chủ tiệm giảm cho khách quen' },
      token: context.token,
    });
    expect(withReason.status).toBe(200);
    expect(await paymentsOf(rentalId)).toEqual([
      expect.objectContaining({ kind: 'late_fee', amount: 100_000 }),
    ]);
  });

  it('the lifecycle rule still wins: settling twice answers rejected_return_not_allowed', async () => {
    const { rentalId } = await overdueRental(1, ['LF-050']);
    await context.request(`/api/v1/rentals/${rentalId}/return`, {
      method: 'POST',
      token: context.token,
    });

    const again = await context.request(`/api/v1/rentals/${rentalId}/return`, {
      method: 'POST',
      body: { lateFee: 0 },
      token: context.staffToken,
    });

    expect(again.status).toBe(422);
    expect(again.body).toMatchObject({
      status: 'rejected_return_not_allowed',
      currentStatus: 'returned',
    });
  });

  it('the quote for an unknown rental is the 404 fault envelope', async () => {
    const response = await context.request(
      '/api/v1/rentals/00000000-0000-4000-8000-0000000000ff/late-fee',
      { token: context.token },
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'GENERIC.NOT_FOUND' } });
  });
});
