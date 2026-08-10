/**
 * THE one seam that reads wire shapes in this app — same contract as apps/fe/src/api/errors.ts
 * (docs/adr/0001-outcome-model-at-the-http-boundary.md). Components branch on the RESULT, never on
 * `error.response.status`.
 *
 * Two shapes exist:
 *   - business outcome `{ status: '<code>', ...payload }`   — 422 / 403 with a named denial
 *   - fault envelope   `{ error: { code, message, details?, correlationId } }`
 */
import Axios from 'axios';

export type ApiOutcome = { kind: 'outcome'; status: string } & Record<string, unknown>;

export type ApiFault = {
  kind: 'fault';
  code: string;
  message: string;
  correlationId?: string;
};

export function mapApiError(error: unknown): ApiOutcome | ApiFault {
  if (Axios.isAxiosError(error)) {
    const body = error.response?.data as
      | { status?: unknown; error?: Partial<ApiFault> }
      | undefined;

    if (body && typeof body.status === 'string') {
      return { ...body, kind: 'outcome', status: body.status } as ApiOutcome;
    }
    if (body?.error?.code) {
      return {
        kind: 'fault',
        code: body.error.code,
        message: body.error.message ?? 'Request failed',
        ...(body.error.correlationId && { correlationId: body.error.correlationId }),
      };
    }
    if (!error.response) {
      return { kind: 'fault', code: 'CLIENT.NETWORK', message: 'Network unreachable' };
    }
    if (error.response.status === 401) {
      return { kind: 'fault', code: 'GENERIC.UNAUTHORIZED', message: 'Unauthenticated' };
    }
    if (error.response.status === 403) {
      return { kind: 'fault', code: 'GENERIC.FORBIDDEN', message: 'Forbidden' };
    }
  }
  return { kind: 'fault', code: 'CLIENT.UNKNOWN', message: 'Unexpected error' };
}

/** Vietnamese copy per outcome code / fault code — the state matrix of ADR 0001 §4. */
export function apiErrorMessage(error: unknown): string {
  const mapped = mapApiError(error);

  if (mapped.kind === 'outcome') {
    switch (mapped.status) {
      case 'rejected_invalid_credentials':
        return 'Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng thử lại.';
      case 'rejected_account_locked':
        return 'Tài khoản đã bị khoá — hỏi chủ tiệm để mở lại.';
      case 'rejected_invalid_refresh_token':
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      default:
        return 'Yêu cầu bị từ chối. Vui lòng kiểm tra lại thông tin.';
    }
  }

  switch (mapped.code) {
    case 'GENERIC.FORBIDDEN':
      return 'Tài khoản này không có quyền dùng QR Admin.';
    case 'GENERIC.UNAUTHORIZED':
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    case 'GENERIC.VALIDATION':
    case 'GENERIC.ARGUMENT_INVALID':
      return 'URL hoặc nhãn chưa hợp lệ. Vui lòng kiểm tra lại.';
    case 'GENERIC.NOT_FOUND':
      return 'Không tìm thấy mã QR này.';
    default:
      return 'Không thể kết nối máy chủ. Vui lòng thử lại.';
  }
}
