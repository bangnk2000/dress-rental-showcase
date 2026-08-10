import { http, HttpResponse, type HttpHandler } from 'msw';

import type {
  CreateUserRequestDto,
  LoginRequestDto,
  MeResponseDto,
  RefreshTokenRequestDto,
  TokenPairResponseDto,
  UserDto,
} from '@/api/generated/model';

/** Fixtures shared with auth tests — shapes come from the generated models. */
export const testUser: MeResponseDto = {
  id: 'user-1',
  username: 'chu-tiem',
  name: 'Chủ tiệm',
  role: 'owner',
};

export const TEST_PASSWORD = 'dung-mat-khau';

/** /users fixtures — the owner (same id as testUser) plus one active and one locked staff. */
export const testUsers: UserDto[] = [
  {
    id: 'user-1',
    username: 'chu-tiem',
    name: 'Chủ tiệm',
    role: 'owner',
    active: true,
    createdAt: '2026-08-01T03:00:00.000Z',
  },
  {
    id: 'user-2',
    username: 'lan',
    name: 'Chị Lan',
    role: 'staff',
    active: true,
    createdAt: '2026-08-02T03:00:00.000Z',
  },
  {
    id: 'user-3',
    username: 'bi-khoa',
    name: 'Bị Khoá',
    role: 'staff',
    active: false,
    createdAt: '2026-08-03T03:00:00.000Z',
  },
];

export const testTokenPair: TokenPairResponseDto = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
};

/**
 * MSW handlers for the identity tag (login/refresh/me), mirroring the two wire shapes of the
 * contract (ADR 0001 §2): wrong credentials / bad refresh token are OUTCOME bodies at 422, while
 * a guard rejecting the access token is the 401 fault envelope.
 */
export const identityHandlers: HttpHandler[] = [
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as LoginRequestDto;
    if (body.username === testUser.username && body.password === TEST_PASSWORD) {
      return HttpResponse.json(testTokenPair);
    }
    return HttpResponse.json({ status: 'rejected_invalid_credentials' }, { status: 422 });
  }),
  http.post('*/api/v1/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as RefreshTokenRequestDto;
    if (body.refreshToken === testTokenPair.refreshToken) {
      return HttpResponse.json(testTokenPair);
    }
    return HttpResponse.json({ status: 'rejected_invalid_refresh_token' }, { status: 422 });
  }),
  http.get('*/api/v1/auth/me', ({ request }) =>
    request.headers.get('authorization')
      ? HttpResponse.json(testUser)
      : HttpResponse.json(
          { error: { code: 'GENERIC.UNAUTHORIZED', message: 'Missing bearer token' } },
          { status: 401 },
        ),
  ),
  http.get('*/api/v1/users', () => HttpResponse.json({ data: testUsers })),
  http.post('*/api/v1/users', async ({ request }) => {
    const body = (await request.json()) as CreateUserRequestDto;
    const normalized = body.username.toLowerCase();
    if (testUsers.some((user) => user.username === normalized)) {
      return HttpResponse.json(
        { status: 'rejected_username_taken', username: normalized },
        { status: 422 },
      );
    }
    return HttpResponse.json({ id: 'user-new' }, { status: 201 });
  }),
  http.post('*/api/v1/users/:id/deactivate', ({ params }) =>
    HttpResponse.json({ id: params.id }),
  ),
  http.post('*/api/v1/users/:id/reactivate', ({ params }) =>
    HttpResponse.json({ id: params.id }),
  ),
  http.post('*/api/v1/users/:id/reset-password', ({ params }) =>
    HttpResponse.json({ id: params.id }),
  ),
];
