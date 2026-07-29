/** Slonik may hand back timestamptz as epoch-ms number, ISO string, or Date. */
export function toDate(value: number | string | Date): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}
