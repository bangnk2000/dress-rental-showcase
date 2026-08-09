import Axios from 'axios';

const REFRESH_TOKEN_STORAGE_KEY = 'dress-rental.qr-admin.refresh-token';

let accessToken: string | null = null;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function setTokens(tokens: TokenPair): void {
  accessToken = tokens.accessToken;
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function clearTokens(): void {
  accessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

type SessionClearedListener = () => void;
const sessionClearedListeners = new Set<SessionClearedListener>();

/**
 * Subscribe to a hard sign-out (refresh failed → tokens cleared). Without this the shell keeps
 * rendering the protected screen after the session dies, and every request on it fails until the
 * owner thinks to reload. Returns an unsubscribe function.
 */
export function subscribeSessionCleared(listener: SessionClearedListener): () => void {
  sessionClearedListeners.add(listener);
  return () => {
    sessionClearedListeners.delete(listener);
  };
}

export function notifySessionCleared(): void {
  for (const listener of sessionClearedListeners) listener();
}

/**
 * Deliberate exemption, same as apps/fe: the refresh call uses a BARE axios instance with no
 * interceptors, so a 401 from /auth/refresh can never recurse into the refresh-and-retry flow.
 */
const bareAxios = Axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the stored refresh token for a new pair (docs/design/qr-admin.md — bearer + refresh).
 * The access token lives in memory only, so a page reload has nothing BUT this to go on:
 * without it every reload signs the owner out while a perfectly good refresh token sits in
 * localStorage. Concurrent callers share one in-flight request.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const { data } = await bareAxios.post<TokenPair>('/api/v1/auth/refresh', { refreshToken });
    setTokens(data);
    return true;
  } catch {
    return false;
  }
}
