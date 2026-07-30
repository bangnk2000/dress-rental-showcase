import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './msw/server';

// jsdom does not implement matchMedia; sonner (and some Radix internals) read it.
if (typeof window !== 'undefined' && window.matchMedia === undefined) {
  const matchMediaStub = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  window.matchMedia = matchMediaStub;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' })); // unmocked call = failing test
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
