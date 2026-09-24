import { describe, expect, it } from 'vitest';

import { isServerOrNetworkError, mapApiError } from '@/api/errors';
import { HttpError } from '@/api/mutator/custom-fetch';

describe('mapApiError', () => {
  it('maps a returned Result Err body to an outcome', () => {
    const mapped = mapApiError(new HttpError(422, { status: 'dress_unavailable', dressId: 'd1' }));
    expect(mapped).toEqual({ kind: 'outcome', status: 'dress_unavailable', dressId: 'd1' });
  });

  it('maps a thrown envelope to a fault', () => {
    const mapped = mapApiError(
      new HttpError(400, { error: { code: 'GENERIC.VALIDATION', message: 'bad', correlationId: 'c1' } }),
    );
    expect(mapped).toEqual({
      kind: 'fault',
      code: 'GENERIC.VALIDATION',
      message: 'bad',
      correlationId: 'c1',
    });
    expect(isServerOrNetworkError(new HttpError(400, { error: { code: 'GENERIC.VALIDATION' } }))).toBe(
      false,
    );
  });

  it('sends bare 5xx, timeouts and network failures to the boundary', () => {
    expect(isServerOrNetworkError(new HttpError(502, undefined))).toBe(true);
    expect(isServerOrNetworkError(new DOMException('t', 'TimeoutError'))).toBe(true);
    expect(isServerOrNetworkError(new TypeError('fetch failed'))).toBe(true);
  });
});
