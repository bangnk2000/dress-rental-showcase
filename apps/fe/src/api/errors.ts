/**
 * THE one seam that reads wire shapes (init-react 04 §3 · docs/adr/0001-outcome-model-at-the-http-boundary.md).
 *
 * The API has exactly two non-success shapes:
 *   - business outcome `{ status: '<code>', ...payload }`   — 422, or 403 for a named denial
 *   - fault envelope   `{ error: { code, message, details?, correlationId } }`
 *
 * Components branch on the RESULT of `mapApiError` — never on `error.response.status`. Success
 * outcomes never come through here: they arrive as `data` in `onSuccess`.
 */
import { isAxiosError } from 'axios';

export type ApiOutcome = { kind: 'outcome'; status: string } & Record<string, unknown>;

export type ApiFaultDetail = { field?: string; rule?: string; message: string };

export type ApiFault = {
  kind: 'fault';
  /** Stable machine code, e.g. 'GENERIC.VALIDATION' — branch on this, never parse `message`. */
  code: string;
  message: string;
  details?: ApiFaultDetail[];
  correlationId?: string;
};

export function mapApiError(error: unknown): ApiOutcome | ApiFault {
  if (isAxiosError(error)) {
    const body = error.response?.data as
      | { status?: unknown; error?: Partial<ApiFault> }
      | undefined;

    if (body && typeof body.status === 'string') {
      return { ...body, kind: 'outcome', status: body.status } as ApiOutcome;
    }
    if (body?.error?.code) {
      const { code, message, details, correlationId } = body.error;
      return {
        kind: 'fault',
        code,
        message: message ?? 'Request failed',
        ...(details && { details }),
        ...(correlationId && { correlationId }),
      };
    }
    if (error.code === 'ECONNABORTED') {
      return { kind: 'fault', code: 'CLIENT.TIMEOUT', message: 'Request timed out' };
    }
    if (!error.response) {
      return { kind: 'fault', code: 'CLIENT.NETWORK', message: 'Network unreachable' };
    }
    if (error.response.status >= 500) {
      // 5xx without an envelope: a proxy/gateway answered instead of the API.
      return { kind: 'fault', code: 'GENERIC.INTERNAL', message: 'Server error' };
    }
    if (error.response.status === 401) {
      return { kind: 'fault', code: 'GENERIC.UNAUTHORIZED', message: 'Unauthenticated' };
    }
  }
  return { kind: 'fault', code: 'CLIENT.UNKNOWN', message: 'Unexpected error' };
}

/**
 * Sugar for the common case "which rejection was it?" — returns the outcome code, or null when the
 * error is a fault. Read payload fields (`dressIds`, `currentStatus`) from `mapApiError` directly.
 */
export function outcomeStatus(error: unknown): string | null {
  const mapped = mapApiError(error);
  return mapped.kind === 'outcome' ? mapped.status : null;
}

const BOUNDARY_CODES = [
  'GENERIC.INTERNAL',
  'GENERIC.HTTP',
  'CLIENT.NETWORK',
  'CLIENT.TIMEOUT',
  'CLIENT.UNKNOWN',
];

/**
 * Boundary predicate for QUERIES: a screen that cannot render without its data sends these to the
 * route error boundary. Mutations never throw to the boundary — they render locally with a retry.
 */
export function isServerOrNetworkError(error: unknown): boolean {
  const mapped = mapApiError(error);
  return mapped.kind === 'fault' && BOUNDARY_CODES.includes(mapped.code);
}

/** 401 — the guard rejected the access token (never a wrong-password rejection: that is an outcome). */
export function isUnauthenticatedError(error: unknown): boolean {
  const mapped = mapApiError(error);
  return mapped.kind === 'fault' && mapped.code === 'GENERIC.UNAUTHORIZED';
}
