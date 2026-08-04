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
