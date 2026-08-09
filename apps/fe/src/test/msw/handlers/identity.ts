import { http, HttpResponse, type HttpHandler } from 'msw';

import type {
  LoginRequestDto,
  MeResponseDto,
  RefreshTokenRequestDto,
  TokenPairResponseDto,
} from '@/api/generated/model';

/** Fixtures shared with auth tests — shapes come from the generated models. */
export const testUser: MeResponseDto = {
  id: 'user-1',
  email: 'chu@tiemvay.vn',
  name: 'Chủ tiệm',
  role: 'owner',
};

export const TEST_PASSWORD = 'dung-mat-khau';

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
    if (body.email === testUser.email && body.password === TEST_PASSWORD) {
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
];
