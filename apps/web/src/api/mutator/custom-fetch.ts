// THE isomorphic HTTP door (docs/spec/init-nextjs/04-data-layer.md §3). Every generated function
// funnels through here, in Server Components and in the browser alike — deliberately neither
// `server-only` nor `client-only`.
//
// No session (apps/web/AGENTS.md deviation #1): this site is anonymous, so there is no cookie to
// forward and no 401 → sign-in handling. A 401 here is a fault like any other.
const isServer = typeof window === 'undefined';

// Contract paths already carry the `/api/v1` prefix. Server side calls the BE directly; the browser
// stays same-origin through the `/api/v1/*` rewrite in next.config.ts.
const baseUrl = (): string => (isServer ? (process.env.API_URL ?? 'http://localhost:3000') : '');

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const res = await fetch(`${baseUrl()}${url}`, {
    // API data is dynamic by default; a public cached surface opts in per call (07 §2).
    cache: 'no-store',
    ...options,
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });

  const body: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) throw new HttpError(res.status, body);
  // orval.config.ts sets includeHttpResponseReturnType: false, so T is the response DTO itself.
  return body as T;
};
