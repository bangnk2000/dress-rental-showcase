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
