import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The access token lives in memory only, so after a page reload the ONLY thing standing between
 * the owner and a forced sign-out is the stored refresh token. These tests pin that recovery.
 */
const post = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => ({
      post,
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    }),
  },
}));

const { clearTokens, getAccessToken, getRefreshToken, refreshSession, setTokens } = await import(
  './auth-tokens'
);

beforeEach(() => {
  post.mockReset();
  clearTokens();
});

describe('refreshSession', () => {
  it('trades the stored refresh token for a fresh pair — the reload path', () => {
    // A reload keeps the stored refresh token and wipes the in-memory access token; recovery
    // reads only the former, which is why this path can run with no access token at all.
    setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    post.mockResolvedValue({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } });

    return refreshSession().then((refreshed) => {
      expect(refreshed).toBe(true);
      expect(post).toHaveBeenCalledWith('/api/v1/auth/refresh', { refreshToken: 'refresh-1' });
      expect(getAccessToken()).toBe('access-2');
      // The rotated refresh token is stored too, or the NEXT reload fails.
      expect(getRefreshToken()).toBe('refresh-2');
    });
  });

  it('reports failure without a stored token instead of calling the API', async () => {
    expect(await refreshSession()).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it('a rejected refresh reports failure rather than throwing at the caller', async () => {
    setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    post.mockRejectedValue(new Error('401'));

    expect(await refreshSession()).toBe(false);
  });

  it('concurrent callers share ONE refresh request', async () => {
    setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    post.mockResolvedValue({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } });

    const [first, second] = await Promise.all([refreshSession(), refreshSession()]);

    expect([first, second]).toEqual([true, true]);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
