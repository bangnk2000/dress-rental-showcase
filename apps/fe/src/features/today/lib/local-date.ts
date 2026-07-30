/**
 * yyyy-mm-dd of a Date in the DEVICE's timezone — the shop tablet's clock
 * rules the board, not the server's (a UTC server flips dates at 7am Hanoi).
 */
export function localDateIso(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
