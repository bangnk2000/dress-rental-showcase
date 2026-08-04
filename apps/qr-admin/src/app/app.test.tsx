import { describe, expect, it } from 'vitest';

import { App } from './app';

describe('App', () => {
  it('exposes the QR admin bootstrap shell', () => {
    expect(App).toBeTypeOf('function');
  });
});
