export const TARGET_URL_MAX_LENGTH = 2_048;
export const LABEL_MAX_LENGTH = 120;

export function validateTargetUrl(value: string): string | null {
  const targetUrl = value.trim();
  if (!targetUrl) return 'Vui lòng nhập URL đích.';
  if (targetUrl.length > TARGET_URL_MAX_LENGTH) return 'URL đích dài tối đa 2.048 ký tự.';

  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      return 'URL phải là http(s) tuyệt đối và không chứa thông tin đăng nhập.';
    }
  } catch {
    return 'URL phải là địa chỉ http(s) tuyệt đối hợp lệ.';
  }
  return null;
}

export function validateLabel(value: string): string | null {
  return value.trim().length > LABEL_MAX_LENGTH ? 'Nhãn dài tối đa 120 ký tự.' : null;
}
