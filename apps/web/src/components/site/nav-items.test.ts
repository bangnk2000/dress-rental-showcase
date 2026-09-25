import { expect, test } from 'vitest';

import { isNavActive } from './nav-items';

test('home is active only on "/", sections also on their children', () => {
  expect(isNavActive('/', '/')).toBe(true);
  expect(isNavActive('/lien-he', '/')).toBe(false);
  expect(isNavActive('/bo-suu-tap', '/bo-suu-tap')).toBe(true);
  expect(isNavActive('/bo-suu-tap/dam-da-hoi-long-lay', '/bo-suu-tap')).toBe(true);
  expect(isNavActive('/bo-suu-tap-khac', '/bo-suu-tap')).toBe(false);
});
