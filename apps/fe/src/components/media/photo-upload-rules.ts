/**
 * The photo-upload vocabulary shared by `PhotoListField` (kernel) and the uploader that talks to the
 * API (`src/api/use-photo-uploader.ts`) — docs/design/catalog/dress-photo-upload.md §2 R1, §4.
 *
 * The rules here MIRROR the BE (CreatePhotoUploadUrl step 2) so a wrong file is refused on the spot
 * without a request (CMS flow a). The BE and R2 still enforce them; this is convenience, not trust.
 */

export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

/** 10 MB — BE `MAX_PHOTO_BYTES` default. A BE configured lower answers 400 with its own maxBytes. */
export const MAX_PHOTO_BYTES = 10_485_760;

/** R4 — at most 10 photos per dress (`@ArrayMaxSize(10)` on the API). */
export const MAX_PHOTOS = 10;

/** One i18n key per reason: `media:errors.<reason>`. */
export type PhotoUploadErrorReason =
  | 'unsupportedType'
  | 'tooLarge'
  | 'storageUnavailable'
  | 'uploadFailed';

/**
 * Why one photo did not upload. `retryable` = a new attempt (new upload URL) may succeed; a wrong
 * type or size never will, so those only offer removal.
 */
export class PhotoUploadError extends Error {
  readonly reason: PhotoUploadErrorReason;
  readonly maxBytes: number | undefined;

  constructor(reason: PhotoUploadErrorReason, maxBytes?: number) {
    super(reason);
    this.name = 'PhotoUploadError';
    this.reason = reason;
    this.maxBytes = maxBytes;
  }

  get retryable(): boolean {
    return this.reason === 'storageUnavailable' || this.reason === 'uploadFailed';
  }
}

export function isPhotoContentType(type: string): type is PhotoContentType {
  return (PHOTO_CONTENT_TYPES as readonly string[]).includes(type);
}

/** Local check before any request (CMS flow a); null = the file may be uploaded. */
export function validatePhotoFile(file: File): PhotoUploadError | null {
  if (!isPhotoContentType(file.type)) return new PhotoUploadError('unsupportedType');
  if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
    return new PhotoUploadError('tooLarge', MAX_PHOTO_BYTES);
  }
  return null;
}

export interface PhotoUploadCallbacks {
  /** 0–100, from XHR `upload.onprogress`. */
  onProgress: (percent: number) => void;
  /** Aborts the PUT (the field unmounted / the photo was removed). */
  signal?: AbortSignal;
}

/**
 * Uploads ONE already-validated file and resolves its public URL (the value stored in
 * `photoUrls`). Rejects with a `PhotoUploadError`. Every call requests a NEW upload URL, so
 * "retry" is simply calling it again (CMS flow c).
 *
 * Injected into `PhotoListField` by the feature: the kernel may not import `src/api`
 * (init-react 02 §4), and the uploader needs the generated client.
 */
export type PhotoUploader = (file: File, callbacks: PhotoUploadCallbacks) => Promise<string>;

/** http(s) link check for a pasted photo URL — same rule the dress form schema applies. */
export const PHOTO_LINK_PATTERN = /^https?:\/\/\S+$/;
