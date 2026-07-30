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
 * MSW handlers for the identity tag (login/refresh/me). Per the OpenAPI spec,
 * 401 responses carry no body.
 */
export const identityHandlers: HttpHandler[] = [
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as LoginRequestDto;
    if (body.email === testUser.email && body.password === TEST_PASSWORD) {
      return HttpResponse.json(testTokenPair);
    }
    return new HttpResponse(null, { status: 401 });
  }),
  http.post('*/api/v1/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as RefreshTokenRequestDto;
    if (body.refreshToken === testTokenPair.refreshToken) {
      return HttpResponse.json(testTokenPair);
    }
    return new HttpResponse(null, { status: 401 });
  }),
  http.get('*/api/v1/auth/me', ({ request }) =>
    request.headers.get('authorization')
      ? HttpResponse.json(testUser)
      : new HttpResponse(null, { status: 401 }),
  ),
];
