/**
 * Intl helpers, fed with the active i18n language (vi by default).
 * Never hand-format currency or dates — word order and separators differ per locale.
 */
import i18n from '@/lib/i18n';

function currentLocale(): string {
  return i18n.language || 'vi';
}

/** VND is an integer currency — no decimals, e.g. 1.500.000 ₫ */
export function formatVnd(amount: number): string {
  return new Intl.NumberFormat(currentLocale(), {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Medium date from an ISO string, e.g. 30 thg 7, 2026 */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(currentLocale(), {
    dateStyle: 'medium',
  }).format(new Date(iso));
}
