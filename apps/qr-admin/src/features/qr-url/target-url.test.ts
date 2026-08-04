import { describe, expect, it } from 'vitest';

import { validateLabel, validateTargetUrl } from './target-url';

describe('QR URL form validation', () => {
  it.each(['https://example.com/path', 'http://intranet.local/path'])('accepts %s', (url) => {
    expect(validateTargetUrl(url)).toBeNull();
  });

  it.each(['javascript:alert(1)', 'data:text/html,no', '/relative', 'https://user:pass@example.com'])(
    'rejects unsafe target %s',
    (url) => {
      expect(validateTargetUrl(url)).not.toBeNull();
    },
  );

  it('limits target and label lengths', () => {
    expect(validateTargetUrl(`https://example.com/${'a'.repeat(2_100)}`)).not.toBeNull();
    expect(validateLabel('x'.repeat(121))).not.toBeNull();
  });
});
