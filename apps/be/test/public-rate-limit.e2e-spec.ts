import { E2eContext, startE2eApp } from './e2e-app';

/**
 * Rate limit of the anonymous `/public/*` API (docs/design/catalog/public-listing.md §Contract
 * check, major + minor findings): a small limit is forced through env so the 429 is reachable; the
 * key is the client IP as nginx forwards it (X-Forwarded-For, trusted only from loopback); staff
 * routes are never throttled; loopback callers (the web's ISR server) are exempt by default.
 */
const LIMIT = 3;

async function publicGet(
  context: E2eContext,
  forwardedFor?: string,
): Promise<number> {
  const response = await fetch(`${context.baseUrl}/api/v1/public/dresses`, {
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
  });
  await response.text();
  return response.status;
}

describe('public catalogue rate limit (loopback exemption OFF)', () => {
  let context: E2eContext;

  beforeAll(async () => {
    context = await startE2eApp({
      env: {
        PUBLIC_THROTTLE_LIMIT: String(LIMIT),
        PUBLIC_THROTTLE_TTL_SEC: '60',
        PUBLIC_THROTTLE_SKIP_LOOPBACK: 'false',
      },
    });
  }, 60_000);

  afterAll(async () => {
    await context.close();
  });

  it('over the limit → 429 on /public/*, while a staff route keeps answering 200', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < LIMIT + 1; i += 1) statuses.push(await publicGet(context));
    expect(statuses).toEqual([200, 200, 200, 429]);
    // The detail route is throttled too (its own per-IP budget per route): 404s, then 429.
    const detail: number[] = [];
    for (let i = 0; i < LIMIT + 1; i += 1) {
      const response = await fetch(`${context.baseUrl}/api/v1/public/dresses/khong-co`);
      await response.text();
      detail.push(response.status);
    }
    expect(detail).toEqual([404, 404, 404, 429]);

    // Staff routes are not throttled at all — well past the public limit.
    for (let i = 0; i < LIMIT * 3; i += 1) {
      const staff = await context.request('/api/v1/dresses', { token: context.token });
      expect(staff.status).toBe(200);
    }
  });

  it('keys on the X-Forwarded-For client (trusted from the loopback nginx): one client does not exhaust another', async () => {
    const first: number[] = [];
    for (let i = 0; i < LIMIT + 1; i += 1) first.push(await publicGet(context, '203.0.113.10'));
    expect(first).toEqual([200, 200, 200, 429]);
    expect(await publicGet(context, '203.0.113.11')).toBe(200);
  });
});

describe('public catalogue rate limit (default: loopback exempt)', () => {
  let context: E2eContext;

  beforeAll(async () => {
    context = await startE2eApp({ env: { PUBLIC_THROTTLE_LIMIT: String(LIMIT) } });
  }, 60_000);

  afterAll(async () => {
    await context.close();
  });

  it('a same-host caller (the web ISR server) is never throttled; a forwarded client still is', async () => {
    for (let i = 0; i < LIMIT * 3; i += 1) expect(await publicGet(context)).toBe(200);
    const forwarded: number[] = [];
    for (let i = 0; i < LIMIT + 1; i += 1) forwarded.push(await publicGet(context, '198.51.100.7'));
    expect(forwarded).toEqual([200, 200, 200, 429]);
  });
});
