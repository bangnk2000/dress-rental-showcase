import { addDays } from '../../../libs/utils/date';

/**
 * Postgres `daterange` ↔ inclusive day interval. We write `[start,end]`;
 * Postgres normalizes to half-open `[start,end+1)`, so parsing converts the
 * exclusive upper bound back to the inclusive last day.
 */
export function toDateRangeLiteral(start: string, endInclusive: string): string {
  return `[${start},${endInclusive}]`;
}

export function fromDateRangeLiteral(literal: string): { start: string; endInclusive: string } {
  const match = /^([[(])(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})([\])])$/.exec(literal);
  if (!match || !match[1] || !match[2] || !match[3] || !match[4]) {
    throw new Error(`Unsupported daterange literal: ${literal}`);
  }
  return {
    start: match[1] === '(' ? addDays(match[2], 1) : match[2],
    endInclusive: match[4] === ')' ? addDays(match[3], -1) : match[3],
  };
}
