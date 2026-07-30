/**
 * Thin error helpers for the api layer — the only code outside the mutator
 * allowed to look at transport details. app/providers.tsx uses this for the
 * QueryClient throwOnError policy.
 */
import { isAxiosError } from 'axios';

/** 5xx responses and network failures belong to error boundaries. */
export function isServerOrNetworkError(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  return error.response === undefined || error.response.status >= 500;
}

/** 401 — invalid credentials or an unauthenticated/expired session. */
export function isUnauthorizedError(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 401;
}
