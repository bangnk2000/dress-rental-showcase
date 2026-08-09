/**
 * yyyy-mm-dd of a Date in the DEVICE's timezone — the shop tablet's clock
 * rules the board, not the server's (a UTC server flips dates at 7am Hanoi).
 */
export function localDateIso(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The day N days from an ISO date, as an ISO date. Built through the local Date constructor (not
 * `Date.parse`, which reads a bare yyyy-mm-dd as UTC) so stepping the board never lands a day off
 * for a tablet east of Greenwich.
 */
export function shiftDateIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return localDateIso(new Date(year, month - 1, day + days));
}
