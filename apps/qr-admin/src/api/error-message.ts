import Axios from 'axios';

export function apiErrorMessage(error: unknown): string {
  if (Axios.isAxiosError(error)) {
    if (error.response?.status === 403) return 'Tài khoản này không có quyền dùng QR Admin.';
    if (error.response?.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error.response?.status === 400) return 'URL hoặc nhãn chưa hợp lệ. Vui lòng kiểm tra lại.';
  }
  return 'Không thể kết nối máy chủ. Vui lòng thử lại.';
}
