import {
  E2eContext,
  OWNER_PASSWORD,
  OWNER_USERNAME,
  STAFF_USERNAME,
  startE2eApp,
} from './e2e-app';

/**
 * identity invariant proofs (docs/design/identity-aggregate.md) + identity/manage-users
 * (docs/design/identity/manage-users.md) + the 401-vs-422 boundary ADR 0001 hinges on.
 */
describe('identity users (real Postgres)', () => {
  let context: E2eContext;

  beforeAll(async () => {
    context = await startE2eApp();
  }, 60_000);

  afterAll(async () => {
    await context.close();
  });

  const login = (username: string, password: string) =>
    context.request('/api/v1/auth/login', { method: 'POST', body: { username, password } });

  const createUser = (body: Record<string, unknown>, token?: string) =>
    context.request('/api/v1/users', { method: 'POST', body, token: token ?? context.token });

  async function userIdOf(username: string): Promise<string> {
    const list = await context.request('/api/v1/users', { token: context.token });
    const rows = (list.body as { data: { id: string; username: string }[] }).data;
    const row = rows.find((r) => r.username === username);
    if (!row) throw new Error(`user ${username} not in list`);
    return row.id;
  }

  it('the DB refuses a duplicate username even with different casing', async () => {
    await expect(
      context.db.seedStaff(OWNER_USERNAME.toUpperCase(), 'staff', 'x'),
    ).rejects.toThrow(/username|unique/i);
  });

  it('the DB refuses a role outside owner|staff', async () => {
    await expect(
      context.db.query(
        `INSERT INTO staff_users (id, username, name, role, password_hash)
         VALUES (gen_random_uuid(), $1, 'Sai role', $2, 'x')`,
        ['role-check', 'superadmin'],
      ),
    ).rejects.toThrow(/role|check/i);
  });

  it('a wrong password is the rejected_invalid_credentials OUTCOME (422), not a 401', async () => {
    const response = await login(OWNER_USERNAME, 'sai-mat-khau');
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
  });

  it('the seeded owner logs in with USERNAME and me carries it', async () => {
    const response = await login(OWNER_USERNAME, OWNER_PASSWORD);
    expect(response.status).toBe(200);

    const me = await context.request('/api/v1/auth/me', {
      token: (response.body as { accessToken: string }).accessToken,
    });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ username: OWNER_USERNAME, role: 'owner' });
  });

  it('AC1: a created account signs in; a duplicate (case-insensitive) is refused with the normalized name', async () => {
    await context.reset();
    const created = await createUser({ username: 'Lan', name: 'Chị Lan', password: 'mat-khau-lan' });
    expect(created.status).toBe(201);

    const signIn = await login('lan', 'mat-khau-lan');
    expect(signIn.status).toBe(200);

    const duplicate = await createUser({
      username: 'LAN',
      name: 'Lan khác',
      password: 'mat-khau-khac',
    });
    expect(duplicate.status).toBe(422);
    expect(duplicate.body).toEqual({ status: 'rejected_username_taken', username: 'lan' });
  });

  it('AC1 race: two concurrent creates of one username yield exactly one account', async () => {
    await context.reset();
    const body = { username: 'trung-ten', name: 'Trùng tên', password: 'mat-khau-999' };
    const [first, second] = await Promise.all([createUser(body), createUser(body)]);

    expect([first.status, second.status].sort()).toEqual([201, 422]);
    const count = await context.db.query(
      `SELECT count(*)::int AS n FROM staff_users WHERE username = 'trung-ten'`,
    );
    expect((count.rows[0] as { n: number }).n).toBe(1);
  });

  it('AC2: a locked account cannot log in (says so) nor refresh; reactivation restores it', async () => {
    await context.reset();
    await createUser({ username: 'bi-khoa', name: 'Bị khoá', password: 'mat-khau-khoa' });

    const beforeLock = await login('bi-khoa', 'mat-khau-khoa');
    expect(beforeLock.status).toBe(200);
    const refreshToken = (beforeLock.body as { refreshToken: string }).refreshToken;

    const id = await userIdOf('bi-khoa');
    const locked = await context.request(`/api/v1/users/${id}/deactivate`, {
      method: 'POST',
      token: context.token,
    });
    expect(locked.status).toBe(200);

    // Correct password + locked account = the NAMED outcome (spec §6.Q4)…
    const lockedLogin = await login('bi-khoa', 'mat-khau-khoa');
    expect(lockedLogin.status).toBe(422);
    expect(lockedLogin.body).toEqual({ status: 'rejected_account_locked' });

    // …while a wrong password stays generic — lock state is only revealed to its owner.
    const wrongPassword = await login('bi-khoa', 'sai-mat-khau');
    expect(wrongPassword.body).toEqual({ status: 'rejected_invalid_credentials' });

    const refresh = await context.request('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
    expect(refresh.status).toBe(422);
    expect(refresh.body).toEqual({ status: 'rejected_invalid_refresh_token' });

    const relock = await context.request(`/api/v1/users/${id}/deactivate`, {
      method: 'POST',
      token: context.token,
    });
    expect(relock.status).toBe(422);
    expect(relock.body).toEqual({ status: 'rejected_user_already_inactive' });

    const unlocked = await context.request(`/api/v1/users/${id}/reactivate`, {
      method: 'POST',
      token: context.token,
    });
    expect(unlocked.status).toBe(200);

    const afterUnlock = await login('bi-khoa', 'mat-khau-khoa');
    expect(afterUnlock.status).toBe(200);
  });

  it('the owner cannot lock their own account', async () => {
    await context.reset();
    const ownId = await userIdOf(OWNER_USERNAME);
    const response = await context.request(`/api/v1/users/${ownId}/deactivate`, {
      method: 'POST',
      token: context.token,
    });
    expect(response.status).toBe(422);
    expect(response.body).toEqual({ status: 'rejected_cannot_deactivate_self' });
  });

  it('AC4: staff calling any user-management endpoint gets the fail-closed 403 envelope', async () => {
    await context.reset();
    const asStaff = await createUser(
      { username: 'lach-quyen', name: 'Lách quyền', password: 'mat-khau-lach' },
      context.staffToken,
    );
    expect(asStaff.status).toBe(403);
    expect(asStaff.body).toMatchObject({ error: { code: 'GENERIC.FORBIDDEN' } });

    const list = await context.request('/api/v1/users', { token: context.staffToken });
    expect(list.status).toBe(403);
  });

  it('AC5: after reset-password the old password is dead and the new one works', async () => {
    await context.reset();
    await createUser({ username: 'doi-mk', name: 'Đổi mật khẩu', password: 'mat-khau-cu-1' });
    const id = await userIdOf('doi-mk');

    const reset = await context.request(`/api/v1/users/${id}/reset-password`, {
      method: 'POST',
      body: { newPassword: 'mat-khau-moi-1' },
      token: context.token,
    });
    expect(reset.status).toBe(200);

    const oldPassword = await login('doi-mk', 'mat-khau-cu-1');
    expect(oldPassword.status).toBe(422);
    expect(oldPassword.body).toEqual({ status: 'rejected_invalid_credentials' });

    const newPassword = await login('doi-mk', 'mat-khau-moi-1');
    expect(newPassword.status).toBe(200);
  });

  it('the user list never carries a password field (key-level check)', async () => {
    await context.reset();
    const list = await context.request('/api/v1/users', { token: context.token });
    expect(list.status).toBe(200);
    for (const row of (list.body as { data: Record<string, unknown>[] }).data) {
      expect(Object.keys(row).sort()).toEqual(
        ['active', 'createdAt', 'id', 'name', 'role', 'username'].sort(),
      );
    }
  });

  it('an unknown user id on the management commands is its own outcome', async () => {
    const ghost = '00000000-0000-4000-8000-000000000000';
    const response = await context.request(`/api/v1/users/${ghost}/reset-password`, {
      method: 'POST',
      body: { newPassword: 'mat-khau-ma-1' },
      token: context.token,
    });
    expect(response.status).toBe(422);
    expect(response.body).toEqual({ status: 'rejected_user_not_found' });
  });

  it('sanity: the staff account seeded by the harness still holds ordinary permissions', async () => {
    await context.reset();
    const me = await context.request('/api/v1/auth/me', { token: context.staffToken });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ username: STAFF_USERNAME, role: 'staff' });
  });
});
