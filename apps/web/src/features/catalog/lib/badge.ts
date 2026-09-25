import type { PublicDressBadge } from '@/api/mock/public-catalog';

export function badgeClassName(badge: PublicDressBadge): string {
  return badge === 'hot' ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface/90 text-primary backdrop-blur';
}
