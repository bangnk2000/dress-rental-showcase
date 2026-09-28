import { listingBadge } from './listing-badge';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-29T12:00:00.000Z');
const daysAgo = (days: number, extraMs = 0) => new Date(NOW.getTime() - days * DAY - extraMs);

describe('listingBadge (spec §6.C)', () => {
  it('hot wins over everything, even a fresh listing', () => {
    expect(listingBadge({ isHot: true, firstPublishedAt: daysAgo(1) }, NOW)).toBe('hot');
    expect(listingBadge({ isHot: true, firstPublishedAt: daysAgo(400) }, NOW)).toBe('hot');
  });

  it('new while first published ≤ 30 days ago — the boundary itself is still new', () => {
    expect(listingBadge({ isHot: false, firstPublishedAt: daysAgo(0) }, NOW)).toBe('new');
    expect(listingBadge({ isHot: false, firstPublishedAt: daysAgo(29) }, NOW)).toBe('new');
    expect(listingBadge({ isHot: false, firstPublishedAt: daysAgo(30) }, NOW)).toBe('new');
  });

  it('available one millisecond past 30 days', () => {
    expect(listingBadge({ isHot: false, firstPublishedAt: daysAgo(30, 1) }, NOW)).toBe(
      'available',
    );
    expect(listingBadge({ isHot: false, firstPublishedAt: daysAgo(31) }, NOW)).toBe('available');
  });

  it('available when never published (defensive — the web never sees drafts)', () => {
    expect(listingBadge({ isHot: false, firstPublishedAt: null }, NOW)).toBe('available');
  });
});
