// The shop's contact facts — configuration, not API data (the BE owns no storefront record).
// Human-readable copy (address, weekday names) lives in messages/vi/common.json `shop.*`.
export const shop = {
  phone: '0901000000',
  phoneDisplay: '0901 000 000',
  handle: '@atelierdemo',
  zaloUrl: 'https://zalo.me/0901000000',
  mapsUrl: 'https://maps.app.goo.gl/example',
  timeZone: 'Asia/Ho_Chi_Minh',
  social: [
    { key: 'facebook', href: 'https://facebook.com/atelierdemo' },
    { key: 'instagram', href: 'https://instagram.com/atelierdemo' },
    { key: 'tiktok', href: 'https://tiktok.com/@atelierdemo' },
    { key: 'zalo', href: 'https://zalo.me/0901000000' },
  ],
  // 0 = Sunday. Minutes since local midnight.
  hours: [
    { days: [1, 2, 3, 4, 5], open: 11 * 60, close: 21 * 60 },
    { days: [0, 6], open: 10 * 60, close: 22 * 60 },
  ],
} as const;

export type SocialKey = (typeof shop.social)[number]['key'];

const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Whether the shop is open at `now`, read on the shop's wall clock (not the viewer's). */
export function isShopOpen(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: shop.timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const day = weekdayIndex[get('weekday')];
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  return shop.hours.some(
    (h) => day !== undefined && (h.days as readonly number[]).includes(day) && minutes >= h.open && minutes < h.close,
  );
}
