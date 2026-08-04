import { TargetUrl } from './target-url.value-object';

describe('TargetUrl', () => {
  it.each(['https://example.com/a', 'http://intranet.local/path?x=1'])('accepts absolute http(s) URL %s', (value) => {
    expect(TargetUrl.create(value).unpack()).toBe(value);
  });

  it.each(['javascript:alert(1)', 'data:text/plain,hi', '/relative', 'https://user:secret@example.com', 'ftp://example.com'])(
    'rejects unsafe or non-web URL %s',
    (value) => expect(() => TargetUrl.create(value)).toThrow('Target URL'),
  );

  it('rejects URL longer than 2048 characters', () => {
    expect(() => TargetUrl.create(`https://example.com/${'a'.repeat(2030)}`)).toThrow('2048');
  });
});
