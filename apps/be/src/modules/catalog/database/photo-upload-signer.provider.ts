import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PHOTO_UPLOAD_SIGNER,
  PhotoUploadSignerPort,
} from '../application/ports/photo-upload-signer.port';
import { DisabledPhotoUploadSignerAdapter } from './disabled-photo-upload-signer.adapter';
import { R2PhotoUploadSignerAdapter } from './r2-photo-upload-signer.adapter';

/** ConfigService falls back to raw process.env, where an unset `KEY=` is ''. */
function nonEmpty(value: string | undefined): string | undefined {
  return value && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * R2 signer when ALL storage env is present, otherwise the disabled one (→ 503 on the endpoint
 * only). IMAGE_PUBLIC_BASE_URL counts: a signed upload whose public url cannot be composed is
 * useless, so it is part of "configured".
 */
export const photoUploadSignerProvider: Provider = {
  provide: PHOTO_UPLOAD_SIGNER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): PhotoUploadSignerPort => {
    const accountId = nonEmpty(config.get<string>('R2_ACCOUNT_ID'));
    const accessKeyId = nonEmpty(config.get<string>('R2_ACCESS_KEY_ID'));
    const secretAccessKey = nonEmpty(config.get<string>('R2_SECRET_ACCESS_KEY'));
    const bucket = nonEmpty(config.get<string>('R2_BUCKET'));
    const publicBaseUrl = nonEmpty(config.get<string>('IMAGE_PUBLIC_BASE_URL'));
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
      return new DisabledPhotoUploadSignerAdapter();
    }
    return new R2PhotoUploadSignerAdapter({ accountId, accessKeyId, secretAccessKey, bucket });
  },
};
