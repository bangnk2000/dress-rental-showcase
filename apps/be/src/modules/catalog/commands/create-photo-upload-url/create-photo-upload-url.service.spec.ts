import { ConfigService } from '@nestjs/config';
import { PhotoUploadSignerPort } from '../../application/ports/photo-upload-signer.port';
import { CreatePhotoUploadUrlCommand } from './create-photo-upload-url.command';
import {
  PhotoStorageUnavailableException,
  PhotoTooLargeException,
  PhotoUnsupportedTypeException,
} from './create-photo-upload-url.errors';
import {
  CreatePhotoUploadUrlService,
  PHOTO_CACHE_CONTROL,
  PHOTO_UPLOAD_EXPIRES_IN_SECONDS,
} from './create-photo-upload-url.service';

const MAX = 10_485_760;
const EXPIRES_AT = new Date('2026-09-25T10:05:00.000Z');

function makeSigner(configured = true): jest.Mocked<PhotoUploadSignerPort> {
  return {
    isConfigured: jest.fn().mockReturnValue(configured),
    sign: jest.fn().mockImplementation(async (input) => ({
      uploadUrl: `https://acct.r2.cloudflarestorage.com/bucket/${input.key}?X-Amz-Signature=x`,
      headers: { 'Content-Type': input.contentType },
      expiresAt: EXPIRES_AT,
    })),
  };
}

function makeConfig(values: Record<string, unknown> = {}): ConfigService {
  const all: Record<string, unknown> = {
    MAX_PHOTO_BYTES: MAX,
    IMAGE_PUBLIC_BASE_URL: 'https://img-dev.example.com',
    ...values,
  };
  return {
    get: (key: string) => all[key],
    getOrThrow: (key: string) => {
      if (all[key] === undefined) throw new Error(`missing ${key}`);
      return all[key];
    },
  } as unknown as ConfigService;
}

const command = (contentType: string, contentLength: number) =>
  new CreatePhotoUploadUrlCommand({ contentType, contentLength });

describe('CreatePhotoUploadUrlService', () => {
  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ])('%s → key photos/<yyyy>/<mm>/<uuid>.%s and public url on the base', async (type, ext) => {
    const signer = makeSigner();
    const result = await new CreatePhotoUploadUrlService(signer, makeConfig()).execute(
      command(type, 2_000_000),
    );

    const input = signer.sign.mock.calls[0]![0];
    expect(input.key).toMatch(
      new RegExp(`^photos/\\d{4}/(0[1-9]|1[0-2])/[0-9a-f-]{36}\\.${ext}$`),
    );
    expect(input).toMatchObject({
      contentType: type,
      contentLength: 2_000_000,
      expiresInSeconds: PHOTO_UPLOAD_EXPIRES_IN_SECONDS,
      cacheControl: PHOTO_CACHE_CONTROL,
    });
    expect(PHOTO_UPLOAD_EXPIRES_IN_SECONDS).toBe(300);
    expect(result).toMatchObject({ method: 'PUT', expiresAt: EXPIRES_AT });
    expect(result.url).toBe(`https://img-dev.example.com/${input.key}`);
  });

  it('uses the current UTC year/month in the key and a fresh uuid per call', async () => {
    const signer = makeSigner();
    const service = new CreatePhotoUploadUrlService(signer, makeConfig());
    const now = new Date();
    await service.execute(command('image/jpeg', 1));
    await service.execute(command('image/jpeg', 1));
    const [first, second] = signer.sign.mock.calls.map(([input]) => input.key);
    const prefix = `photos/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/`;
    expect(first!.startsWith(prefix)).toBe(true);
    expect(first).not.toBe(second);
  });

  it('strips a trailing slash from IMAGE_PUBLIC_BASE_URL', async () => {
    const result = await new CreatePhotoUploadUrlService(
      makeSigner(),
      makeConfig({ IMAGE_PUBLIC_BASE_URL: 'https://img.example.com/' }),
    ).execute(command('image/png', 10));
    expect(result.url).toMatch(/^https:\/\/img\.example\.com\/photos\//);
  });

  it.each(['image/gif', 'image/svg+xml', 'application/pdf', 'IMAGE/JPEG', '', 'toString'])(
    'rejects %p with PHOTO.UNSUPPORTED_TYPE before looking at size or storage',
    async (type) => {
      const signer = makeSigner(false);
      const promise = new CreatePhotoUploadUrlService(signer, makeConfig()).execute(
        command(type, MAX + 1),
      );
      await expect(promise).rejects.toBeInstanceOf(PhotoUnsupportedTypeException);
      await expect(promise).rejects.toMatchObject({ code: 'PHOTO.UNSUPPORTED_TYPE' });
      expect(signer.sign).not.toHaveBeenCalled();
    },
  );

  it.each([0, -1, MAX + 1])('rejects contentLength %p with PHOTO.TOO_LARGE + maxBytes', async (n) => {
    const signer = makeSigner(false);
    const promise = new CreatePhotoUploadUrlService(signer, makeConfig()).execute(
      command('image/jpeg', n),
    );
    await expect(promise).rejects.toBeInstanceOf(PhotoTooLargeException);
    const error = (await promise.catch((e: unknown) => e)) as PhotoTooLargeException;
    expect(error.toJSON()).toMatchObject({
      code: 'PHOTO.TOO_LARGE',
      details: [{ field: 'contentLength', maxBytes: MAX }],
    });
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it('accepts exactly MAX_PHOTO_BYTES and 1 byte', async () => {
    const service = new CreatePhotoUploadUrlService(makeSigner(), makeConfig());
    await expect(service.execute(command('image/webp', MAX))).resolves.toMatchObject({
      method: 'PUT',
    });
    await expect(service.execute(command('image/webp', 1))).resolves.toMatchObject({
      method: 'PUT',
    });
  });

  it('honours a configured MAX_PHOTO_BYTES', async () => {
    const promise = new CreatePhotoUploadUrlService(
      makeSigner(),
      makeConfig({ MAX_PHOTO_BYTES: 1000 }),
    ).execute(command('image/jpeg', 1001));
    await expect(promise).rejects.toMatchObject({ code: 'PHOTO.TOO_LARGE', maxBytes: 1000 });
  });

  it('valid input on an unconfigured signer → PHOTO.STORAGE_UNAVAILABLE', async () => {
    const signer = makeSigner(false);
    const promise = new CreatePhotoUploadUrlService(signer, makeConfig()).execute(
      command('image/jpeg', 100),
    );
    await expect(promise).rejects.toBeInstanceOf(PhotoStorageUnavailableException);
    await expect(promise).rejects.toMatchObject({ code: 'PHOTO.STORAGE_UNAVAILABLE' });
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it('missing public base url → PHOTO.STORAGE_UNAVAILABLE even if the signer is configured', async () => {
    const promise = new CreatePhotoUploadUrlService(
      makeSigner(),
      makeConfig({ IMAGE_PUBLIC_BASE_URL: undefined }),
    ).execute(command('image/jpeg', 100));
    await expect(promise).rejects.toBeInstanceOf(PhotoStorageUnavailableException);
  });
});
