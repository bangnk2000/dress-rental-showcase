import { ConfigService } from '@nestjs/config';
import { PhotoUploadSignerPort } from '../../application/ports/photo-upload-signer.port';
import { CreatePhotoUploadUrlCommand, PhotoUploadFile } from './create-photo-upload-url.command';
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

const file = (contentType: string, contentLength: number): PhotoUploadFile => ({
  contentType,
  contentLength,
});
const command = (...files: PhotoUploadFile[]) => new CreatePhotoUploadUrlCommand({ files });

describe('CreatePhotoUploadUrlService', () => {
  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ])('%s → key photos/<yyyy>/<mm>/<uuid>.%s and public url on the base', async (type, ext) => {
    const signer = makeSigner();
    const [result] = await new CreatePhotoUploadUrlService(signer, makeConfig()).execute(
      command(file(type, 2_000_000)),
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
    expect(result!.url).toBe(`https://img-dev.example.com/${input.key}`);
  });

  it('signs every file of the batch in request order, each under a fresh key in the current UTC month', async () => {
    const signer = makeSigner();
    const now = new Date();
    const results = await new CreatePhotoUploadUrlService(signer, makeConfig()).execute(
      command(file('image/jpeg', 1), file('image/png', 2), file('image/webp', 3)),
    );

    expect(signer.sign.mock.calls.map(([input]) => input.contentLength)).toEqual([1, 2, 3]);
    expect(results.map((result) => result.url.split('.').pop())).toEqual(['jpg', 'png', 'webp']);
    const keys = signer.sign.mock.calls.map(([input]) => input.key);
    expect(new Set(keys).size).toBe(3);
    const prefix = `photos/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/`;
    expect(keys.every((key) => key.startsWith(prefix))).toBe(true);
  });

  it('strips a trailing slash from IMAGE_PUBLIC_BASE_URL', async () => {
    const [result] = await new CreatePhotoUploadUrlService(
      makeSigner(),
      makeConfig({ IMAGE_PUBLIC_BASE_URL: 'https://img.example.com/' }),
    ).execute(command(file('image/png', 10)));
    expect(result!.url).toMatch(/^https:\/\/img\.example\.com\/photos\//);
  });

  it.each(['image/gif', 'image/svg+xml', 'application/pdf', 'IMAGE/JPEG', '', 'toString'])(
    'rejects %p with PHOTO.UNSUPPORTED_TYPE before looking at size or storage',
    async (type) => {
      const signer = makeSigner(false);
      const promise = new CreatePhotoUploadUrlService(signer, makeConfig()).execute(
        command(file(type, MAX + 1)),
      );
      await expect(promise).rejects.toBeInstanceOf(PhotoUnsupportedTypeException);
      await expect(promise).rejects.toMatchObject({ code: 'PHOTO.UNSUPPORTED_TYPE' });
      expect(signer.sign).not.toHaveBeenCalled();
    },
  );

  it.each([0, -1, MAX + 1])('rejects contentLength %p with PHOTO.TOO_LARGE + maxBytes', async (n) => {
    const signer = makeSigner(false);
    const promise = new CreatePhotoUploadUrlService(signer, makeConfig()).execute(
      command(file('image/jpeg', n)),
    );
    await expect(promise).rejects.toBeInstanceOf(PhotoTooLargeException);
    const error = (await promise.catch((e: unknown) => e)) as PhotoTooLargeException;
    expect(error.toJSON()).toMatchObject({
      code: 'PHOTO.TOO_LARGE',
      details: [{ field: 'files.0.contentLength', maxBytes: MAX }],
    });
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it('one bad file fails the whole batch, names its index, and nothing is signed', async () => {
    const signer = makeSigner();
    const service = new CreatePhotoUploadUrlService(signer, makeConfig());

    const tooLarge = (await service
      .execute(command(file('image/jpeg', 1), file('image/jpeg', MAX + 1)))
      .catch((e: unknown) => e)) as PhotoTooLargeException;
    expect(tooLarge.toJSON()).toMatchObject({
      code: 'PHOTO.TOO_LARGE',
      details: [{ field: 'files.1.contentLength' }],
    });

    const wrongType = (await service
      .execute(command(file('image/jpeg', 1), file('image/png', 1), file('image/gif', 1)))
      .catch((e: unknown) => e)) as PhotoUnsupportedTypeException;
    expect(wrongType.toJSON()).toMatchObject({
      code: 'PHOTO.UNSUPPORTED_TYPE',
      details: [{ field: 'files.2.contentType' }],
    });
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it('accepts exactly MAX_PHOTO_BYTES and 1 byte', async () => {
    const results = await new CreatePhotoUploadUrlService(makeSigner(), makeConfig()).execute(
      command(file('image/webp', MAX), file('image/webp', 1)),
    );
    expect(results).toHaveLength(2);
  });

  it('honours a configured MAX_PHOTO_BYTES', async () => {
    const promise = new CreatePhotoUploadUrlService(
      makeSigner(),
      makeConfig({ MAX_PHOTO_BYTES: 1000 }),
    ).execute(command(file('image/jpeg', 1001)));
    await expect(promise).rejects.toMatchObject({ code: 'PHOTO.TOO_LARGE', maxBytes: 1000 });
  });

  it('valid input on an unconfigured signer → PHOTO.STORAGE_UNAVAILABLE', async () => {
    const signer = makeSigner(false);
    const promise = new CreatePhotoUploadUrlService(signer, makeConfig()).execute(
      command(file('image/jpeg', 100)),
    );
    await expect(promise).rejects.toBeInstanceOf(PhotoStorageUnavailableException);
    await expect(promise).rejects.toMatchObject({ code: 'PHOTO.STORAGE_UNAVAILABLE' });
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it('missing public base url → PHOTO.STORAGE_UNAVAILABLE even if the signer is configured', async () => {
    const promise = new CreatePhotoUploadUrlService(
      makeSigner(),
      makeConfig({ IMAGE_PUBLIC_BASE_URL: undefined }),
    ).execute(command(file('image/jpeg', 100)));
    await expect(promise).rejects.toBeInstanceOf(PhotoStorageUnavailableException);
  });
});
