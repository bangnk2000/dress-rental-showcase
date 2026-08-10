/** Slonik may hand back timestamptz as epoch-ms number, ISO string, or Date. */
export function toDate(value: number | string | Date): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

/** Calendar-date arithmetic on `yyyy-mm-dd` strings, in UTC (no DST surprises). */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days between two `yyyy-mm-dd` calendar dates (later - earlier); negative if reversed. */
export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const from = new Date(`${fromIsoDate}T00:00:00Z`).getTime();
  const to = new Date(`${toIsoDate}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/**
 * The shop's calendar day. One shop, one timezone — and the late fee is money, so it must not
 * depend on whether the VPS clock is UTC: a return at 8am Hanoi on the 10th is the 10th, always.
 * (The today board takes its date from the device instead, because a staff member may look at
 * another day on purpose; a fee has no such freedom.)
 */
export const SHOP_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function shopToday(now: Date = new Date()): string {
  // en-CA renders as yyyy-mm-dd.
  return now.toLocaleDateString('en-CA', { timeZone: SHOP_TIME_ZONE });
}
