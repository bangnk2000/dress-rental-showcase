import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  PHOTO_UPLOAD_SIGNER,
  PhotoUploadSignerPort,
} from '../../application/ports/photo-upload-signer.port';
import { CreatePhotoUploadUrlCommand } from './create-photo-upload-url.command';
import {
  PhotoStorageUnavailableException,
  PhotoTooLargeException,
  PhotoUnsupportedTypeException,
} from './create-photo-upload-url.errors';

/** Content type → file extension of the key. The whitelist IS this map (R1). */
export const PHOTO_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const PHOTO_UPLOAD_EXPIRES_IN_SECONDS = 300;
/** Keys are never overwritten (new uuid per upload), so the original is cacheable forever. */
export const PHOTO_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface PhotoUploadUrl {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  url: string;
  expiresAt: Date;
}

function extensionOf(contentType: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(PHOTO_EXTENSIONS, contentType)
    ? PHOTO_EXTENSIONS[contentType]
    : undefined;
}

/**
 * Validation order per docs/design/catalog/dress-photo-upload.md §2 flow: type → size → storage,
 * over EVERY file before anything is signed — one bad file fails the batch (the CMS checked them
 * locally, so a batch failure means a client bug or a lower server limit). The guard
 * (`photo:upload`) ran before this handler. Failures are THROWN envelope faults, not returned
 * outcomes — there is no business rejection in this use case (ADR 0001 §3).
 */
@CommandHandler(CreatePhotoUploadUrlCommand)
export class CreatePhotoUploadUrlService
  implements ICommandHandler<CreatePhotoUploadUrlCommand, PhotoUploadUrl[]>
{
  constructor(
    @Inject(PHOTO_UPLOAD_SIGNER)
    private readonly signer: PhotoUploadSignerPort,
    private readonly config: ConfigService,
  ) {}

  async execute(command: CreatePhotoUploadUrlCommand): Promise<PhotoUploadUrl[]> {
    const maxBytes = this.config.getOrThrow<number>('MAX_PHOTO_BYTES');
    const extensions = command.files.map((file, index) => {
      const extension = extensionOf(file.contentType);
      if (!extension) throw new PhotoUnsupportedTypeException(index);
      if (file.contentLength <= 0 || file.contentLength > maxBytes) {
        throw new PhotoTooLargeException(maxBytes, index);
      }
      return extension;
    });

    const baseUrl = this.config.get<string>('IMAGE_PUBLIC_BASE_URL')?.trim().replace(/\/+$/, '');
    if (!this.signer.isConfigured() || !baseUrl) throw new PhotoStorageUnavailableException();

    const now = new Date();
    const prefix = `photos/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    return Promise.all(
      command.files.map(async (file, index) => {
        const key = `${prefix}/${randomUUID()}.${extensions[index]}`;
        const signed = await this.signer.sign({
          key,
          contentType: file.contentType,
          contentLength: file.contentLength,
          expiresInSeconds: PHOTO_UPLOAD_EXPIRES_IN_SECONDS,
          cacheControl: PHOTO_CACHE_CONTROL,
        });
        return {
          uploadUrl: signed.uploadUrl,
          method: 'PUT' as const,
          headers: signed.headers,
          url: `${baseUrl}/${key}`,
          expiresAt: signed.expiresAt,
        };
      }),
    );
  }
}
