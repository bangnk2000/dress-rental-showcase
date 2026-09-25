import { R2PhotoUploadSignerAdapter } from './r2-photo-upload-signer.adapter';

/** Pure local signing with fake credentials — no network, no real bucket. */
describe('R2PhotoUploadSignerAdapter', () => {
  const issuedAt = new Date('2026-09-25T10:00:00.000Z');
  const adapter = new R2PhotoUploadSignerAdapter(
    {
      accountId: 'fakeaccount0123',
      accessKeyId: 'FAKEACCESSKEY',
      secretAccessKey: 'fake-secret-access-key',
      bucket: 'dress-rental-test-media',
    },
    () => issuedAt,
  );
  const input = {
    key: 'photos/2026/09/6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a.jpg',
    contentType: 'image/jpeg',
    contentLength: 2_097_152,
    expiresInSeconds: 300,
    cacheControl: 'public, max-age=31536000, immutable',
  };

  it('presigns a PUT on the R2 endpoint for exactly that key, valid 300 s', async () => {
    const signed = await adapter.sign(input);
    const url = new URL(signed.uploadUrl);

    expect(url.origin).toBe('https://fakeaccount0123.r2.cloudflarestorage.com');
    expect(url.pathname).toBe(`/dress-rental-test-media/${input.key}`);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Credential')).toMatch(/^FAKEACCESSKEY\/20260925\/auto\/s3\//);
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(signed.expiresAt.toISOString()).toBe('2026-09-25T10:05:00.000Z');
  });

  it('signs Content-Type, Content-Length and Cache-Control as headers', async () => {
    const signed = await adapter.sign(input);
    const signedHeaders = new URL(signed.uploadUrl).searchParams
      .get('X-Amz-SignedHeaders')!
      .split(';');

    expect(signedHeaders).toEqual(
      expect.arrayContaining(['content-type', 'content-length', 'cache-control', 'host']),
    );
    // Content-Length is signed but not returned: the browser derives it from the body.
    expect(signed.headers).toEqual({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
  });

  it('puts no checksum of the empty presign body into the URL', async () => {
    const signed = await adapter.sign(input);
    const keys = [...new URL(signed.uploadUrl).searchParams.keys()].map((k) => k.toLowerCase());
    expect(keys.some((k) => k.startsWith('x-amz-checksum'))).toBe(false);
    expect(keys).not.toContain('x-amz-sdk-checksum-algorithm');
  });

  it('a different declared size yields a different signature', async () => {
    const a = new URL((await adapter.sign(input)).uploadUrl).searchParams.get('X-Amz-Signature');
    const b = new URL((await adapter.sign({ ...input, contentLength: 2_097_153 })).uploadUrl)
      .searchParams.get('X-Amz-Signature');
    expect(a).not.toBe(b);
  });
});
