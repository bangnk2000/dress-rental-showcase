import {
  ArgumentInvalidException,
  ServiceUnavailableException,
} from '../../../../libs/exceptions/exceptions';

/*
 * Envelope codes of catalog/dress-photo-upload (ADR 0001 §3 "Không có outcome" — photo upload).
 * No BUSINESS rejection here: a wrong type/size is invalid input and missing storage is a technical
 * fault, so these are THROWN and rendered as `{ error: { code, … } }` by the global filter.
 * One bad file fails the whole batch; `details[0].field` names which one (`files.<i>.…`).
 */

/** 400 — not image/jpeg, image/png or image/webp. */
export class PhotoUnsupportedTypeException extends ArgumentInvalidException {
  override readonly code = 'PHOTO.UNSUPPORTED_TYPE';

  constructor(readonly index: number) {
    super('Only JPEG, PNG and WebP images are accepted', undefined, undefined, [
      {
        field: `files.${index}.contentType`,
        rule: 'in',
        message: 'Only JPEG, PNG and WebP images are accepted',
      },
    ]);
  }
}

/** 400 — contentLength ≤ 0 or > MAX_PHOTO_BYTES; `details[0].maxBytes` carries the limit. */
export class PhotoTooLargeException extends ArgumentInvalidException {
  override readonly code = 'PHOTO.TOO_LARGE';

  constructor(
    readonly maxBytes: number,
    readonly index: number,
  ) {
    super(`Photo must be between 1 and ${maxBytes} bytes`, undefined, undefined, [
      {
        field: `files.${index}.contentLength`,
        rule: 'max',
        message: `Photo must be between 1 and ${maxBytes} bytes`,
        maxBytes,
      },
    ]);
  }
}

/** 503 — R2 env is incomplete on this server. */
export class PhotoStorageUnavailableException extends ServiceUnavailableException {
  override readonly code = 'PHOTO.STORAGE_UNAVAILABLE';

  constructor() {
    super('Photo storage is not configured');
  }
}
