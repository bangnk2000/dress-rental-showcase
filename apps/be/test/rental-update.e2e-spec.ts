import { E2eContext, rentalBody, startE2eApp } from './e2e-app';

interface ItemRow {
  dress_id: string;
  price: number;
  blocked_until: string;
  blocking: boolean;
}

interface RentalDetail {
  rentalId: string;
  customerName: string;
  customerPhone: string;
  status: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  discountAmount: number;
  dresses: { dressId: string; agreedPrice: number; blockedUntilDate: string; blocking: boolean }[];
}

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
 * FR-RENT-12/13 proofs (docs/design/rentals/update-rental.md): the owner's edit re-blocks every
 * item, BR-1 holds across the edit (pre-check, race and raw SQL), the item list reconciles by
 * dress, a closed rental is immutable, staff may edit too (owner decision 2026-11-07), and the detail read returns
 * what the edit wrote. CLEANING_BUFFER_DAYS=2 in this harness.
 */
describe('rental update + detail (real Postgres)', () => {
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

  async function createRental(
    dressIds: string[],
    start: string,
    end: string,
    extra: Record<string, unknown> = {},
  ): Promise<string> {
    const response = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: { ...rentalBody(dressIds, start, end), ...extra },
      token: context.token,
    });
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  async function itemRows(rentalId: string): Promise<ItemRow[]> {
    const result = await context.db.query<ItemRow>(
      `SELECT dress_id, price, to_char(upper(blocked_period) - 1, 'YYYY-MM-DD') AS blocked_until, blocking
       FROM rental_items WHERE rental_id = $1 ORDER BY dress_id`,
      [rentalId],
    );
    return result.rows;
  }

  async function patch(rentalId: string, body: unknown, token = context.token) {
    return context.request(`/api/v1/rentals/${rentalId}`, { method: 'PATCH', body, token });
  }

  it('AC6: GET /rentals/:id returns the rental in full, notes and calendar blocks included; unknown → 404 envelope', async () => {
    const dressId = await context.db.seedDress('UPD-001');
    const rentalId = await createRental([dressId], '2027-01-10', '2027-01-12', {
      notes: 'Khách quen, hẹn 9h',
      discountAmount: 100_000,
    });

    const detail = await context.request(`/api/v1/rentals/${rentalId}`, { token: context.token });
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      rentalId,
      customerName: 'Nguyễn Thị Hoa',
      status: 'booked',
      startDate: '2027-01-10',
      endDate: '2027-01-12',
      notes: 'Khách quen, hẹn 9h',
      discountAmount: 100_000,
      dresses: [
        { dressId, agreedPrice: 1_500_000, blockedUntilDate: '2027-01-14', blocking: true },
      ],
    });

    // Staff can read it too — reads need authentication only.
    const asStaff = await context.request(`/api/v1/rentals/${rentalId}`, {
      token: context.staffToken,
    });
    expect(asStaff.status).toBe(200);

    const unknown = await context.request(
      '/api/v1/rentals/00000000-0000-4000-8000-0000000000ff',
      { token: context.token },
    );
    expect(unknown.status).toBe(404);
    expect(unknown.body).toMatchObject({ error: { code: 'GENERIC.NOT_FOUND' } });
  });

  it('AC2: extending the return date moves EVERY item block (buffer included) and the detail reads it back', async () => {
    const first = await context.db.seedDress('UPD-002');
    const second = await context.db.seedDress('UPD-003');
    const rentalId = await createRental([first, second], '2027-02-10', '2027-02-12');

    const response = await patch(rentalId, { endDate: '2027-02-14' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: rentalId });

    const rows = await itemRows(rentalId);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.blocked_until).toBe('2027-02-16');
      expect(row.blocking).toBe(true);
    }
    const detail = await context.request(`/api/v1/rentals/${rentalId}`, { token: context.token });
    expect(detail.body).toMatchObject({ startDate: '2027-02-10', endDate: '2027-02-14' });
    expect((detail.body as RentalDetail).dresses.map((d) => d.blockedUntilDate)).toEqual([
      '2027-02-16',
      '2027-02-16',
    ]);
  });

  it("AC2: extending into another rental's block is the SAME outcome as create, and nothing moves; the rental's own block is never a conflict", async () => {
    const dressId = await context.db.seedDress('UPD-004');
    const rentalId = await createRental([dressId], '2027-03-10', '2027-03-12'); // blocks to 03-14
    await createRental([dressId], '2027-03-17', '2027-03-19'); // neighbour, blocks 03-17..21

    // 03-16 + 2 buffer days = 03-18 → overlaps the neighbour's 03-17.
    const refused = await patch(rentalId, { endDate: '2027-03-16' });
    expect(refused.status).toBe(422);
    expect(refused.body).toEqual({ status: 'rejected_dress_unavailable', dressIds: [dressId] });
    expect((await itemRows(rentalId))[0]!.blocked_until).toBe('2027-03-14'); // untouched

    // 03-14 + 2 = 03-16 < 03-17 → free. The new block overlaps the rental's OWN old block, which
    // must not count (the pre-check excludes it; the EXCLUDE never checks a row against itself).
    const allowed = await patch(rentalId, { endDate: '2027-03-14' });
    expect(allowed.status).toBe(200);
    expect((await itemRows(rentalId))[0]!.blocked_until).toBe('2027-03-16');
  });

  it('AC2 race: an edit adding a dress and a booking of that dress for the same days → exactly one wins, the loser gets rejected_dress_unavailable', async () => {
    const first = await context.db.seedDress('UPD-005');
    const contested = await context.db.seedDress('UPD-006');
    const rentalId = await createRental([first], '2027-04-10', '2027-04-12');

    // Fired together so both clear the availability pre-check; only the EXCLUDE constraint can
    // pick the winner. Whichever way it falls, the loser must carry the create outcome code.
    const [edit, booking] = await Promise.all([
      patch(rentalId, { items: [{ dressId: first }, { dressId: contested }] }),
      context.request('/api/v1/rentals', {
        method: 'POST',
        body: rentalBody([contested], '2027-04-10', '2027-04-12'),
        token: context.token,
      }),
    ]);

    const outcomes = [edit.status, booking.status].sort();
    expect(outcomes).toEqual(expect.arrayContaining([422]));
    expect(outcomes.filter((s) => s === 422)).toHaveLength(1);
    const loser = edit.status === 422 ? edit : booking;
    expect(loser.body).toEqual({ status: 'rejected_dress_unavailable', dressIds: [contested] });

    // Exactly one blocking row holds the contested dress for those days.
    const holders = await context.db.query(
      'SELECT rental_id FROM rental_items WHERE dress_id = $1 AND blocking',
      [contested],
    );
    expect(holders.rowCount).toBe(1);
  });

  it('BR-1: the DB refuses a raw UPDATE that moves an item block onto another rental', async () => {
    const dressId = await context.db.seedDress('UPD-007');
    const rentalId = await createRental([dressId], '2027-05-10', '2027-05-12');
    await createRental([dressId], '2027-05-20', '2027-05-22');

    await expect(
      context.db.query(
        `UPDATE rental_items SET blocked_period = daterange('2027-05-18', '2027-05-24', '[]')
         WHERE rental_id = $1`,
        [rentalId],
      ),
    ).rejects.toThrow(/rental_items_no_overlap|exclusion/i);
  });

  it('AC3: replacing the list drops the removed row, adds the new dress at the standard price, keeps the AGREED price of a kept dress', async () => {
    const kept = await context.db.seedDress('UPD-008');
    const removed = await context.db.seedDress('UPD-009');
    const added = await context.db.seedDress('UPD-010');
    const rentalId = await createRental([], '2027-06-10', '2027-06-12', {
      items: [{ dressId: kept, price: 900_000 }, { dressId: removed }],
    });
    // The catalog price of the kept dress moves AFTER booking — the agreement must survive.
    await context.db.query('UPDATE dresses SET rental_price = 9999999 WHERE id = $1', [kept]);

    const swap = await patch(rentalId, { items: [{ dressId: kept }, { dressId: added }] });
    expect(swap.status).toBe(200);

    const rows = await itemRows(rentalId);
    expect(rows.map((row) => row.dress_id).sort()).toEqual([kept, added].sort());
    expect(rows.find((row) => row.dress_id === kept)!.price).toBe(900_000);
    expect(rows.find((row) => row.dress_id === added)!.price).toBe(1_500_000); // seeded standard
    expect(rows.every((row) => row.blocked_until === '2027-06-14')).toBe(true);

    // An explicit price wins; the removed dress is bookable again by someone else.
    const reprice = await patch(rentalId, {
      items: [
        { dressId: kept, price: 1_000_000 },
        { dressId: added, price: 700_000 },
      ],
    });
    expect(reprice.status).toBe(200);
    expect(
      (await itemRows(rentalId)).map((row) => row.price).sort((a, b) => a - b),
    ).toEqual([700_000, 1_000_000]);
    const rebook = await createRental([removed], '2027-06-10', '2027-06-12');
    expect(rebook).toBeTruthy();
  });

  it('§6.Q4: a kept dress retired after booking does not block the edit; adding a retired dress does', async () => {
    const kept = await context.db.seedDress('UPD-011');
    const retiredNew = await context.db.seedDress('UPD-012', { retired: true });
    const rentalId = await createRental([kept], '2027-07-10', '2027-07-12');
    await context.db.query("UPDATE dresses SET status = 'retired' WHERE id = $1", [kept]);

    const phoneOnly = await patch(rentalId, { customerPhone: '0909999999' });
    expect(phoneOnly.status).toBe(200);

    const addRetired = await patch(rentalId, {
      items: [{ dressId: kept }, { dressId: retiredNew }],
    });
    expect(addRetired.status).toBe(422);
    expect(addRetired.body).toEqual({ status: 'rejected_dress_retired', dressIds: [retiredNew] });
  });

  it('AC1: a cancelled rental refuses the edit by name and stays exactly as it was', async () => {
    const dressId = await context.db.seedDress('UPD-013');
    const rentalId = await createRental([dressId], '2027-08-10', '2027-08-12');
    const cancel = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      token: context.token,
    });
    expect(cancel.status).toBe(200);

    const refused = await patch(rentalId, { customerName: 'Người khác', endDate: '2027-08-15' });
    expect(refused.status).toBe(422);
    expect(refused.body).toEqual({
      status: 'rejected_update_not_allowed',
      currentStatus: 'cancelled',
    });

    const row = await context.db.query<{ customer_name: string; status: string }>(
      'SELECT customer_name, status FROM rentals WHERE id = $1',
      [rentalId],
    );
    expect(row.rows[0]).toEqual({ customer_name: 'Nguyễn Thị Hoa', status: 'cancelled' });
    expect((await itemRows(rentalId))[0]).toMatchObject({ blocking: false, blocked_until: '2027-08-14' });
  });

  it('AC1: an edit never changes the status — a booked rental moved to start today stays booked', async () => {
    const today = shopToday();
    const dressId = await context.db.seedDress('UPD-014');
    const rentalId = await createRental([dressId], shiftDays(today, 10), shiftDays(today, 12));

    const response = await patch(rentalId, { startDate: today, endDate: shiftDays(today, 1) });
    expect(response.status).toBe(200);

    const row = await context.db.query<{ status: string }>(
      'SELECT status FROM rentals WHERE id = $1',
      [rentalId],
    );
    expect(row.rows[0]!.status).toBe('booked'); // create would have been born out; an edit is not a handover
  });

  it('AC5 (amended 2026-11-07): staff passes the policy guard and the edit is written', async () => {
    const dressId = await context.db.seedDress('UPD-015');
    const rentalId = await createRental([dressId], '2027-09-10', '2027-09-12');

    const edited = await patch(
      rentalId,
      { customerName: 'Staff sửa', discountAmount: 100_000 },
      context.staffToken,
    );
    expect(edited.status).toBe(200);

    const row = await context.db.query<{ customer_name: string; discount_amount: string }>(
      'SELECT customer_name, discount_amount FROM rentals WHERE id = $1',
      [rentalId],
    );
    expect(row.rows[0]!.customer_name).toBe('Staff sửa');
    expect(Number(row.rows[0]!.discount_amount)).toBe(100_000);
  });

  it('AC4: a discount above the NEW item total is a 400 envelope; notes null clears, omitted keeps', async () => {
    const dressId = await context.db.seedDress('UPD-016');
    const rentalId = await createRental([dressId], '2027-10-10', '2027-10-12', {
      notes: 'Giữ lại',
    });

    const tooLarge = await patch(rentalId, { discountAmount: 1_500_001 });
    expect(tooLarge.status).toBe(400);
    expect(tooLarge.body).toMatchObject({ error: { code: 'GENERIC.ARGUMENT_INVALID' } });

    const ok = await patch(rentalId, { discountAmount: 200_000 });
    expect(ok.status).toBe(200);
    let detail = await context.request(`/api/v1/rentals/${rentalId}`, { token: context.token });
    expect(detail.body).toMatchObject({ discountAmount: 200_000, notes: 'Giữ lại' });

    const cleared = await patch(rentalId, { notes: null });
    expect(cleared.status).toBe(200);
    detail = await context.request(`/api/v1/rentals/${rentalId}`, { token: context.token });
    expect((detail.body as RentalDetail).notes).toBeNull();
  });

  it('an unknown rental is the named outcome, not a 404', async () => {
    const response = await patch('00000000-0000-4000-8000-0000000000ff', { customerName: 'X' });
    expect(response.status).toBe(422);
    expect(response.body).toEqual({ status: 'rejected_rental_not_found' });
  });
});
