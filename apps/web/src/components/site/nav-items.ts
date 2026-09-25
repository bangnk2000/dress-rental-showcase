import { House, Phone, Shirt, type LucideIcon } from 'lucide-react';

// ONE item set on every page and breakpoint (design/responsive.md §3).
export const navItems = [
  { key: 'home', href: '/', icon: House },
  { key: 'collection', href: '/bo-suu-tap', icon: Shirt },
  { key: 'contact', href: '/lien-he', icon: Phone },
] as const satisfies readonly { key: string; href: string; icon: LucideIcon }[];

/** `pathname` is locale-less (next-intl usePathname). A product page keeps "Bộ sưu tập" active. */
export function isNavActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
