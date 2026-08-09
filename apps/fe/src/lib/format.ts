/**
 * Intl helpers. Never hand-format currency or dates — word order and separators differ per locale.
 *
 * The locale comes from `<html lang>`, which `lib/i18n.ts` keeps in sync on every language change
 * and `index.html` seeds with `vi`. Deliberately NOT the i18next singleton: a kernel helper that
 * imports the app instance formats with a different language than the text around it whenever the
 * two instances disagree — which is exactly what happened under test (vi text, en money).
 */
function currentLocale(): string {
  const lang = typeof document === 'undefined' ? '' : document.documentElement.lang;
  return lang || 'vi';
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
