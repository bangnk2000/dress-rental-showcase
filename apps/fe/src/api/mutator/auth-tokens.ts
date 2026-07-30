/**
 * Token plumbing for the api layer.
 *
 * The access token lives in a module variable (never persisted); the refresh
 * token lives in localStorage. The auth feature consumes this module through
 * the exported functions — it never touches storage or axios directly.
 */
import Axios from 'axios';

const REFRESH_TOKEN_STORAGE_KEY = 'dress-rental.refresh-token';

let accessToken: string | null = null;

type SessionClearedListener = () => void;
const sessionClearedListeners = new Set<SessionClearedListener>();

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

/**
 * Subscribe to hard sign-out (refresh failed → tokens cleared). Returns an
 * unsubscribe function. The auth feature uses this to reset its session state.
 */
export function subscribeSessionCleared(cb: SessionClearedListener): () => void {
  sessionClearedListeners.add(cb);
  return () => {
    sessionClearedListeners.delete(cb);
  };
}

export function notifySessionCleared(): void {
  for (const listener of sessionClearedListeners) {
    listener();
  }
}

/**
 * Deliberate exemption: the refresh call uses a BARE axios instance with no
 * interceptors, so a 401 from /auth/refresh can never recurse into the
 * refresh-and-retry flow of the main instance.
 */
const bareAxios = Axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the stored refresh token for a new token pair. Concurrent callers
 * share one in-flight request. Returns true when the session was refreshed.
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
    const { data } = await bareAxios.post<TokenPair>('/api/v1/auth/refresh', {
      refreshToken,
    });
    setTokens(data);
    return true;
  } catch {
    return false;
  }
}
