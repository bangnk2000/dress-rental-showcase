// The ONE seam that reads wire error shapes (ADR 0001; docs/spec/init-nextjs/04-data-layer.md §3).
// Components branch on the result's `kind` / `status` / `code` — never on HTTP status codes.
import { HttpError } from '@/api/mutator/custom-fetch';

export type ApiOutcome = { kind: 'outcome'; status: string } & Record<string, unknown>;
export type ApiFault = {
  kind: 'fault';
  code: string;
  message: string;
  details?: { field?: string; rule?: string; message: string }[];
  correlationId?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function mapApiError(e: unknown): ApiOutcome | ApiFault {
  if (e instanceof HttpError) {
    const body = e.body;
    if (isRecord(body) && typeof body.status === 'string') {
      return { ...body, kind: 'outcome', status: body.status };
    }
    if (isRecord(body) && isRecord(body.error) && typeof body.error.code === 'string') {
      const { code, message, details, correlationId } = body.error;
      return {
        kind: 'fault',
        code,
        message: typeof message === 'string' ? message : '',
        ...(Array.isArray(details) ? { details: details as ApiFault['details'] } : {}),
        ...(typeof correlationId === 'string' ? { correlationId } : {}),
      };
    }
    if (e.status >= 500) return { kind: 'fault', code: 'GENERIC.INTERNAL', message: 'Server error' };
    return { kind: 'fault', code: 'GENERIC.HTTP', message: `HTTP ${e.status}` };
  }
  if (e instanceof DOMException && e.name === 'TimeoutError') {
    return { kind: 'fault', code: 'CLIENT.TIMEOUT', message: 'Request timed out' };
  }
  if (e instanceof TypeError) {
    return { kind: 'fault', code: 'CLIENT.NETWORK', message: 'Network unreachable' };
  }
  return { kind: 'fault', code: 'CLIENT.UNKNOWN', message: 'Unexpected error' };
}

const BOUNDARY_CODES = [
  'GENERIC.INTERNAL',
  'GENERIC.HTTP',
  'CLIENT.NETWORK',
  'CLIENT.TIMEOUT',
  'CLIENT.UNKNOWN',
];

/** Query faults the screen cannot render without → the segment's error.tsx (04 §4). */
export function isServerOrNetworkError(error: unknown): boolean {
  const mapped = mapApiError(error);
  return mapped.kind === 'fault' && BOUNDARY_CODES.includes(mapped.code);
}
