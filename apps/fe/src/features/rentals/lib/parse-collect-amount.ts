/**
 * A typed amount of money handed over at booking (FR-RENT-14) as whole VND ≥ 1, or null when blank
 * or not an amount — "not collected" is the ABSENCE of a ledger row, never a 0₫ row (BR-4).
 */
export function parseCollectAmount(raw: string): number | null {
  const trimmed = raw.trim();
  // Digits only: `Number('500.000')` is 500, so a Vietnamese thousands separator would silently
  // record 500₫ for five hundred thousand (found by Codex PR #39 C1's test).
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}
