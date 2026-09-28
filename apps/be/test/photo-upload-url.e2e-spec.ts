import { E2eContext, startE2eApp } from './e2e-app';

/**
 * FR-CAT-10 (docs/design/catalog/dress-photo-upload.md §2, §9): the signing endpoint over the real
 * wire — guard, validation order, envelope codes, one batch per form submit. Signing is local HMAC,
 * so FAKE R2 credentials produce well-formed URLs without any network; nothing here talks to
 * Cloudflare.
 */
const FAKE_R2_ENV = {
  R2_ACCOUNT_ID: 'e2efakeaccount',
  R2_ACCESS_KEY_ID: 'E2EFAKEACCESSKEY',
  R2_SECRET_ACCESS_KEY: 'e2e-fake-secret-access-key',
  R2_BUCKET: 'e2e-media',
  IMAGE_PUBLIC_BASE_URL: 'https://img-e2e.example.com/',
  MAX_PHOTO_BYTES: '10485760',
};

/** '' = unset, and it wins over apps/be/.env (see startE2eApp). */
const NO_R2_ENV = {
  R2_ACCOUNT_ID: '',
  R2_ACCESS_KEY_ID: '',
  R2_SECRET_ACCESS_KEY: '',
  R2_BUCKET: '',
  IMAGE_PUBLIC_BASE_URL: '',
};

const PATH = '/api/v1/photos/upload-urls';

interface UploadUrlBody {
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
  url: string;
  expiresAt: string;
}

interface UploadUrlsBody {
  uploads: UploadUrlBody[];
}

const one = (contentType: string, contentLength: number) => ({
  files: [{ contentType, contentLength }],
});

describe('photo upload-url signing (R2 configured with fake keys)', () => {
  let context: E2eContext;

  beforeAll(async () => {
    context = await startE2eApp({ env: FAKE_R2_ENV });
  }, 60_000);

  afterAll(async () => {
    await context.close();
  });

  const sign = (body: unknown, token: string | null = context.token) =>
    context.request(PATH, { method: 'POST', body, token });

  it('201: presigned PUT with signed Content-Type/Content-Length/Cache-Control, 300 s, public url', async () => {
    const before = Date.now();
    const response = await sign(one('image/png', 2_097_152));
    expect(response.status).toBe(201);

    const { uploads } = response.body as UploadUrlsBody;
    expect(uploads).toHaveLength(1);
    const body = uploads[0]!;
    expect(Object.keys(body).sort()).toEqual(
      ['expiresAt', 'headers', 'method', 'uploadUrl', 'url'].sort(),
    );
    expect(body.method).toBe('PUT');
    // Content-Length is signed (below) but not returned: the browser derives it from the body.
    expect(body.headers).toEqual({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    const upload = new URL(body.uploadUrl);
    expect(upload.origin).toBe('https://e2efakeaccount.r2.cloudflarestorage.com');
    const key = upload.pathname.replace(/^\/e2e-media\//, '');
    expect(key).toMatch(/^photos\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(upload.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(upload.searchParams.get('X-Amz-SignedHeaders')!.split(';')).toEqual(
      expect.arrayContaining(['content-type', 'content-length', 'cache-control']),
    );

    // Trailing slash of IMAGE_PUBLIC_BASE_URL dropped; the stored url never points at the S3 API.
    expect(body.url).toBe(`https://img-e2e.example.com/${key}`);

    const expiresAt = Date.parse(body.expiresAt);
    expect(expiresAt - before).toBeGreaterThanOrEqual(299_000);
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(301_000);
  });

  it('one request signs the whole form submit: N files → N uploads, same order, distinct keys', async () => {
    const response = await sign({
      files: [
        { contentType: 'image/jpeg', contentLength: 100 },
        { contentType: 'image/png', contentLength: 200 },
        { contentType: 'image/webp', contentLength: 300 },
      ],
    });
    expect(response.status).toBe(201);
    const { uploads } = response.body as UploadUrlsBody;
    expect(uploads.map((upload) => upload.headers['Content-Type'])).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(uploads.map((upload) => upload.url.split('.').pop())).toEqual(['jpg', 'png', 'webp']);
    expect(new Set(uploads.map((upload) => upload.url)).size).toBe(3);
  });

  it('staff (not only the owner) may sign — photo:upload is every authenticated role', async () => {
    const response = await sign(one('image/jpeg', 1), context.staffToken);
    expect(response.status).toBe(201);
    expect((response.body as UploadUrlsBody).uploads[0]!.url).toMatch(/\.jpg$/);
  });

  it('401 without a token', async () => {
    const response = await sign(one('image/jpeg', 1), null);
    expect(response.status).toBe(401);
  });

  it('400 PHOTO.UNSUPPORTED_TYPE for a non-whitelisted type (envelope, not GENERIC.VALIDATION)', async () => {
    const response = await sign(one('image/gif', 1000));
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: { code: 'PHOTO.UNSUPPORTED_TYPE', details: [{ field: 'files.0.contentType' }] },
    });
  });

  it.each([10_485_761, 0])('400 PHOTO.TOO_LARGE with maxBytes for contentLength %p', async (n) => {
    const response = await sign(one('image/jpeg', n));
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: 'PHOTO.TOO_LARGE',
        details: [{ field: 'files.0.contentLength', rule: 'max', maxBytes: 10_485_760 }],
      },
    });
  });

  it('one bad file fails the whole batch and names its index', async () => {
    const response = await sign({
      files: [
        { contentType: 'image/jpeg', contentLength: 100 },
        { contentType: 'image/jpeg', contentLength: 10_485_761 },
      ],
    });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: { code: 'PHOTO.TOO_LARGE', details: [{ field: 'files.1.contentLength' }] },
    });
  });

  it('exactly MAX_PHOTO_BYTES is accepted', async () => {
    const response = await sign(one('image/webp', 10_485_760));
    expect(response.status).toBe(201);
  });

  it('400 GENERIC.VALIDATION for a malformed body (non-integer size, extra field, empty or >10 files)', async () => {
    const malformed = [
      one('image/jpeg', 1.5),
      { files: [{ contentType: 'image/jpeg', contentLength: 10, key: 'x' }] },
      { files: [] },
      { files: Array.from({ length: 11 }, () => ({ contentType: 'image/jpeg', contentLength: 1 })) },
      { contentType: 'image/jpeg', contentLength: 10 },
    ];
    for (const body of malformed) {
      const response = await sign(body);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ error: { code: 'GENERIC.VALIDATION' } });
    }
  });
});

describe('photo upload-url signing (R2 NOT configured)', () => {
  let context: E2eContext;

  beforeAll(async () => {
    context = await startE2eApp({ env: NO_R2_ENV });
  }, 60_000);

  afterAll(async () => {
    await context.close();
  });

  it('the app boots and the endpoint alone answers 503 PHOTO.STORAGE_UNAVAILABLE', async () => {
    const response = await context.request(PATH, {
      method: 'POST',
      body: one('image/jpeg', 1000),
      token: context.token,
    });
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: { code: 'PHOTO.STORAGE_UNAVAILABLE' } });

    const dresses = await context.request('/api/v1/dresses', { token: context.token });
    expect(dresses.status).toBe(200);
  });

  it('type/size validation still runs first (400 before 503)', async () => {
    const response = await context.request(PATH, {
      method: 'POST',
      body: one('image/gif', 1000),
      token: context.token,
    });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'PHOTO.UNSUPPORTED_TYPE' } });
  });
});
