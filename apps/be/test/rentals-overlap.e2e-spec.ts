import { E2eContext, rentalBody, startE2eApp } from './e2e-app';

/**
 * BR-1 / BR-2 / BR-3 proof tests — the invariants the design doc says the DATABASE enforces
 * (docs/design/rentals-aggregate.md). Every case provokes the real constraint; a passing
 * application pre-check is not proof, so the raw-SQL cases bypass the app entirely.
 */
describe('rentals invariants (real Postgres)', () => {
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

  it('BR-1: an overlapping booking is rejected with the rejected_dress_unavailable outcome', async () => {
    const dressId = await context.db.seedDress('E2E-001');

    const first = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], '2026-09-01', '2026-09-03'),
      token: context.token,
    });
    expect(first.status).toBe(201);

    const overlapping = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], '2026-09-03', '2026-09-05'),
      token: context.token,
    });

    expect(overlapping.status).toBe(422);
    expect(overlapping.body).toEqual({
      status: 'rejected_dress_unavailable',
      dressIds: [dressId],
    });
  });

  it('BR-1: the cleaning buffer keeps blocking after the return date', async () => {
    const dressId = await context.db.seedDress('E2E-002');

    await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], '2026-09-10', '2026-09-12'),
      token: context.token,
    });

    // CLEANING_BUFFER_DAYS=2 → the 13th and 14th are still blocked, the 15th is free.
    const insideBuffer = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], '2026-09-14', '2026-09-16'),
      token: context.token,
    });
    expect(insideBuffer.status).toBe(422);
    expect((insideBuffer.body as { status: string }).status).toBe('rejected_dress_unavailable');

    const afterBuffer = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], '2026-09-15', '2026-09-17'),
      token: context.token,
    });
    expect(afterBuffer.status).toBe(201);
  });

  it('BR-1 race: two concurrent bookings → exactly one 201, the loser gets the SAME outcome', async () => {
    const dressId = await context.db.seedDress('E2E-003');
    const body = rentalBody([dressId], '2026-10-01', '2026-10-03');

    // Fired together so both clear the availability pre-check; only the EXCLUDE constraint can
    // pick the winner. The loser must not surface as a 500 or a different code (ADR 0001 §2).
    const [a, b] = await Promise.all([
      context.request('/api/v1/rentals', { method: 'POST', body, token: context.token }),
      context.request('/api/v1/rentals', { method: 'POST', body, token: context.token }),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 422]);
    const loser = a.status === 422 ? a : b;
    expect(loser.body).toEqual({ status: 'rejected_dress_unavailable', dressIds: [dressId] });

    const rows = await context.db.query('SELECT id FROM rentals');
    expect(rows.rowCount).toBe(1);
  });

  it('BR-1: the DB refuses an overlapping row even when the application is bypassed', async () => {
    const contested = await context.db.seedDress('E2E-004');
    const other = await context.db.seedDress('E2E-004B');

    await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([contested], '2026-11-01', '2026-11-03'),
      token: context.token,
    });
    const second = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([other], '2026-11-01', '2026-11-03'),
      token: context.token,
    });
    const secondRentalId = (second.body as { id: string }).id;

    // Raw INSERT into a DIFFERENT rental — so UNIQUE (rental_id, dress_id) cannot be what refuses
    // it. No service, no pre-check: if this succeeds, BR-1 is only a convention.
    await expect(
      context.db.query(
        `INSERT INTO rental_items (id, rental_id, dress_id, price, blocked_period, blocking)
         VALUES (gen_random_uuid(), $1, $2, 100, daterange('2026-11-02', '2026-11-06', '[]'), true)`,
        [secondRentalId, contested],
      ),
    ).rejects.toThrow(/rental_items_no_overlap|exclusion/i);
  });

  it('BR-2: the same dress twice in one rental is refused by the DTO and by the DB', async () => {
    const dressId = await context.db.seedDress('E2E-005');

    const viaApi = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: {
        ...rentalBody([dressId], '2026-12-01', '2026-12-02'),
        items: [{ dressId }, { dressId }],
      },
      token: context.token,
    });
    expect(viaApi.status).toBe(400);
    expect((viaApi.body as { error: { code: string } }).error.code).toBe('GENERIC.VALIDATION');

    await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], '2026-12-10', '2026-12-11'),
      token: context.token,
    });
    // blocking=false dodges the overlap constraint, so this proves the UNIQUE pair specifically.
    await expect(
      context.db.query(
        `INSERT INTO rental_items (id, rental_id, dress_id, price, blocked_period, blocking)
         SELECT gen_random_uuid(), r.id, $1, 100, daterange('2027-01-01', '2027-01-02', '[]'), false
         FROM rentals r LIMIT 1`,
        [dressId],
      ),
    ).rejects.toThrow(/rental_id|unique/i);
  });

  it('BR-3: the DB rejects a status outside the lifecycle, and the API rejects an illegal move', async () => {
    const dressId = await context.db.seedDress('E2E-006');
    const created = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], '2027-02-01', '2027-02-03'),
      token: context.token,
    });
    const rentalId = (created.body as { id: string }).id;

    await expect(
      context.db.query('UPDATE rentals SET status = $1 WHERE id = $2', ['teleported', rentalId]),
    ).rejects.toThrow(/status|check/i);

    // booked → cancelled is legal; cancelling twice is the named business rejection.
    const cancel = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      token: context.token,
    });
    expect(cancel.status).toBe(200);

    const again = await context.request(`/api/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      token: context.token,
    });
    expect(again.status).toBe(422);
    expect(again.body).toEqual({
      status: 'rejected_cancel_not_allowed',
      currentStatus: 'cancelled',
    });
  });

  it('a cancelled booking frees the calendar for the same period', async () => {
    const dressId = await context.db.seedDress('E2E-007');
    const created = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], '2027-03-01', '2027-03-03'),
      token: context.token,
    });
    await context.request(`/api/v1/rentals/${(created.body as { id: string }).id}/cancel`, {
      method: 'POST',
      token: context.token,
    });

    const rebooked = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([dressId], '2027-03-01', '2027-03-03'),
      token: context.token,
    });
    expect(rebooked.status).toBe(201);
  });

  it('a retired dress is rejected with its own outcome code, not the unavailable one', async () => {
    const retiredId = await context.db.seedDress('E2E-008', { retired: true });

    const response = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody([retiredId], '2027-04-01', '2027-04-02'),
      token: context.token,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ status: 'rejected_dress_retired', dressIds: [retiredId] });
  });

  it('an unknown dress id is rejected with rejected_dress_not_found', async () => {
    const response = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody(['00000000-0000-4000-8000-0000000000ff'], '2027-05-01', '2027-05-02'),
      token: context.token,
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ status: 'rejected_dress_not_found' });
  });

  it('an unauthenticated write is the 401 fault envelope, never an outcome', async () => {
    const response = await context.request('/api/v1/rentals', {
      method: 'POST',
      body: rentalBody(['00000000-0000-4000-8000-0000000000ff'], '2027-06-01', '2027-06-02'),
      token: null,
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: 'GENERIC.UNAUTHORIZED' } });
  });
});
