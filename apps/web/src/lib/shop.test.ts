import { describe, expect, test } from 'vitest';

import { formatVnd, formatVndCompact } from './format';
import { isShopOpen } from './shop';

// Instants in UTC; the shop is UTC+7 (Asia/Ho_Chi_Minh, no DST).
const at = (iso: string) => new Date(iso);

describe('isShopOpen — read on the shop clock, not the viewer’s', () => {
  test.each([
    ['Mon 15:00 (weekday, open 14–22)', '2026-09-21T08:00:00Z', true],
    ['Mon 13:59', '2026-09-21T06:59:00Z', false],
    ['Mon 22:00 (close is exclusive)', '2026-09-21T15:00:00Z', false],
    ['Sat 10:30 (weekend, open 10–22)', '2026-09-26T03:30:00Z', true],
    ['Sun 09:59', '2026-09-27T02:59:00Z', false],
    // 23:30 UTC Sunday is already Monday 06:30 in Hà Nội — closed, not "Sunday evening"
    ['Mon 06:30 local (Sun in UTC)', '2026-09-27T23:30:00Z', false],
  ])('%s', (_label, iso, open) => {
    expect(isShopOpen(at(iso))).toBe(open);
  });
});

describe('price formatting', () => {
  test('full and compact VND, the shop’s own notation', () => {
    expect(formatVnd(350_000)).toBe('350.000đ');
    expect(formatVnd(2_800_000)).toBe('2.800.000đ');
    expect(formatVndCompact(2_800_000)).toBe('2.800k');
    expect(formatVndCompact(950_000)).toBe('950k');
  });
});
