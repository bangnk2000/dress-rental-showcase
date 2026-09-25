import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react';
import { afterEach, vi } from 'vitest';

// jsdom has no Next router: the locale-aware Link renders a plain anchor, the pathname is '/'.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    createElement('a', { href, ...props }),
  usePathname: () => '/',
}));

// …and no image loader: next/image renders a plain <img> (drop the Next-only props).
vi.mock('next/image', () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const img = { ...props };
    delete img.fill;
    delete img.priority;
    return createElement('img', img);
  },
}));

afterEach(() => cleanup());
