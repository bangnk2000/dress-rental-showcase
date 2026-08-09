import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { apiErrorMessage, mapApiError } from './errors';

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const error = new AxiosError('request failed', 'ERR_BAD_REQUEST');
  error.response = {
    status,
    statusText: '',
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

/** The seam must tell a business rejection apart from a transport fault (ADR 0001 §2). */
describe('mapApiError', () => {
  it('reads a 422 outcome body as an outcome, payload included', () => {
    const mapped = mapApiError(
      axiosErrorWith(422, { status: 'rejected_invalid_credentials' }),
    );

    expect(mapped).toEqual({ kind: 'outcome', status: 'rejected_invalid_credentials' });
  });

  it('reads the fault envelope as a fault with its stable code', () => {
    const mapped = mapApiError(
      axiosErrorWith(403, {
        error: { code: 'GENERIC.FORBIDDEN', message: 'Forbidden', correlationId: 'req-9' },
      }),
    );

    expect(mapped).toEqual({
      kind: 'fault',
      code: 'GENERIC.FORBIDDEN',
      message: 'Forbidden',
      correlationId: 'req-9',
    });
  });

  it('falls back to a fault for a bodiless response', () => {
    expect(mapApiError(axiosErrorWith(401, undefined))).toMatchObject({
      kind: 'fault',
      code: 'GENERIC.UNAUTHORIZED',
    });
    expect(mapApiError(new Error('boom'))).toMatchObject({ code: 'CLIENT.UNKNOWN' });
  });
});

describe('apiErrorMessage', () => {
  it('separates a wrong password from a missing permission', () => {
    const wrongPassword = apiErrorMessage(
      axiosErrorWith(422, { status: 'rejected_invalid_credentials' }),
    );
    const noPermission = apiErrorMessage(
      axiosErrorWith(403, { error: { code: 'GENERIC.FORBIDDEN', message: 'Forbidden' } }),
    );

    expect(wrongPassword).toContain('mật khẩu');
    expect(noPermission).toContain('không có quyền');
    expect(wrongPassword).not.toBe(noPermission);
  });

  it('maps an invalid target URL to the form message', () => {
    expect(
      apiErrorMessage(
        axiosErrorWith(400, {
          error: { code: 'GENERIC.ARGUMENT_INVALID', message: 'Target URL must be absolute' },
        }),
      ),
    ).toContain('URL');
  });
});
