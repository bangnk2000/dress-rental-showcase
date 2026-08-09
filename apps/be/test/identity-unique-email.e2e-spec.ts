import { E2eContext, OWNER_EMAIL, OWNER_PASSWORD, startE2eApp } from './e2e-app';

/**
 * identity invariant proofs (docs/design/identity-aggregate.md) plus the 401-vs-422 boundary that
 * ADR 0001 hinges on: a wrong password is an OUTCOME, a rejected token is a FAULT.
 */
describe('identity invariants (real Postgres)', () => {
  let context: E2eContext;

  beforeAll(async () => {
    context = await startE2eApp();
  }, 60_000);

  afterAll(async () => {
    await context.close();
  });

  it('the DB refuses a duplicate staff email', async () => {
    await expect(context.db.seedStaff(OWNER_EMAIL, 'staff', 'x')).rejects.toThrow(/email|unique/i);
  });

  it('the DB refuses a role outside owner|staff', async () => {
    await expect(
      context.db.query(
        `INSERT INTO staff_users (id, email, name, role, password_hash)
         VALUES (gen_random_uuid(), $1, 'Sai role', $2, 'x')`,
        ['role-check@e2e', 'superadmin'],
      ),
    ).rejects.toThrow(/role|check/i);
  });

  it('a wrong password is the rejected_invalid_credentials OUTCOME (422), not a 401', async () => {
    const response = await context.request('/api/v1/auth/login', {
      method: 'POST',
      body: { email: OWNER_EMAIL, password: 'sai-mat-khau' },
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ status: 'rejected_invalid_credentials' });
  });

  it('an invalid refresh token is its own outcome code', async () => {
    const response = await context.request('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: 'not-a-real-token' },
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ status: 'rejected_invalid_refresh_token' });
  });

  it('a rejected access token is the 401 FAULT envelope — the seam the FE retries on', async () => {
    const missing = await context.request('/api/v1/auth/me', { token: null });
    expect(missing.status).toBe(401);
    expect(missing.body).toMatchObject({ error: { code: 'GENERIC.UNAUTHORIZED' } });

    const garbage = await context.request('/api/v1/auth/me', { token: 'garbage.token.value' });
    expect(garbage.status).toBe(401);
    expect(garbage.body).toMatchObject({ error: { code: 'GENERIC.UNAUTHORIZED' } });
  });

  it('the seeded owner can log in and read its profile', async () => {
    const login = await context.request('/api/v1/auth/login', {
      method: 'POST',
      body: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
    });
    expect(login.status).toBe(200);

    const me = await context.request('/api/v1/auth/me', {
      token: (login.body as { accessToken: string }).accessToken,
    });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: OWNER_EMAIL, role: 'owner' });
  });
});
