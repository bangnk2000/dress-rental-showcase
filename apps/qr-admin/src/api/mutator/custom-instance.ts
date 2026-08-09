import Axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { clearTokens, getAccessToken, refreshSession } from './auth-tokens';

export const AXIOS_INSTANCE = Axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── 401 → refresh-and-retry, once (same protocol as apps/fe) ─────────────────
// Login/refresh 401s are terminal ("bad credentials" / "session expired"), never "stale access
// token": routing them through the refresh flow would clear the session on a mistyped password.
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
    if (await refreshSession()) return AXIOS_INSTANCE(original);
    clearTokens();
  }
  throw error;
});

/** The sole HTTP door for generated hooks and future QR-specific blob requests. */
export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => AXIOS_INSTANCE({ ...config, ...options }).then(({ data }) => data as T);
