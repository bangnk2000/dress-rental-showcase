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

export interface PhotoUploadOptions {
  /** 0–100 for the file at `index`, from XHR `upload.onprogress`. */
  onProgress: (index: number, percent: number) => void;
  /** Aborts every PUT still running (the form was closed). */
  signal?: AbortSignal;
}

/** Per-file outcome of one batch; the uploader never rejects, one bad file never sinks the rest. */
export type PhotoUploadResult = { ok: true; url: string } | { ok: false; error: PhotoUploadError };

/**
 * Uploads a batch of already-validated files — ONE request signs every URL, then one PUT per file
 * runs in parallel — and resolves one result per file, in input order (docs/design/catalog/
 * dress-photo-upload.md §9). Every call signs NEW URLs, so "retry" is simply calling it again with
 * the files that failed.
 *
 * Injected by the feature (the dress form calls it on Save): the kernel may not import `src/api`
 * (init-react 02 §4), and the uploader needs the generated client.
 */
export type PhotoUploader = (
  files: readonly File[],
  options: PhotoUploadOptions,
) => Promise<PhotoUploadResult[]>;

/** http(s) link check for a pasted photo URL — same rule the dress form schema applies. */
export const PHOTO_LINK_PATTERN = /^https?:\/\/\S+$/;
