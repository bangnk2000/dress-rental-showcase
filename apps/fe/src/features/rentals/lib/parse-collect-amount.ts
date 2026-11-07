/**
 * A typed amount of money handed over at booking (FR-RENT-14) as whole VND ≥ 1, or null when blank
 * or not an amount — "not collected" is the ABSENCE of a ledger row, never a 0₫ row (BR-4).
 */
export function parseCollectAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 1 ? value : null;
}
