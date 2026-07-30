/**
 * THE adapter — every Orval-generated hook funnels through customInstance.
 * This is the only place that knows about tokens, refresh, base URLs, or
 * HTTP status codes. Components read error objects from hooks; they never
 * inspect error.response.status.
 */
import Axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import {
  clearTokens,
  getAccessToken,
  notifySessionCleared,
  refreshSession,
} from './auth-tokens';

export const AXIOS_INSTANCE = Axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// ── auth header ──────────────────────────────────────────────────────────────
AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── 401 → refresh-and-retry, once ────────────────────────────────────────────
// Login/refresh 401s are terminal ("bad credentials" / "session expired"),
// never "stale access token" — routing them through the refresh flow would be
// wasteful noise and would clear the session on a mistyped password.
const REFRESH_EXEMPT_URLS = ['/api/v1/auth/login', '/api/v1/auth/refresh'];
const isRefreshExempt = (url: string | undefined): boolean =>
  url !== undefined && REFRESH_EXEMPT_URLS.some((exempt) => url.endsWith(exempt));

AXIOS_INSTANCE.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as
    | (InternalAxiosRequestConfig & { _retried?: boolean })
    | undefined;
  if (
    error.response?.status === 401 &&
    original &&
    !original._retried &&
    !isRefreshExempt(original.url)
  ) {
    original._retried = true;
    const refreshed = await refreshSession(); // deduped inside auth-tokens
    if (refreshed) return AXIOS_INSTANCE(original);
    clearTokens();
    notifySessionCleared(); // hard sign-out; the auth feature reacts
  }
  throw error;
});

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  // TanStack Query v5 cancellation: Orval passes the query signal in `config`.
  return AXIOS_INSTANCE({ ...config, ...options }).then(({ data }) => data as T);
};
