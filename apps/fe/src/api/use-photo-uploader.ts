/**
 * Direct-to-R2 photo upload (docs/design/catalog/dress-photo-upload.md §2 CMS flow b–c, §9).
 * Called ONCE per form Save with every photo that still has to be uploaded:
 *
 *   1. ONE POST /api/v1/photos/upload-urls through the generated client (the ONE API door: auth
 *      header, 401 refresh) → one { uploadUrl, headers, url } per file, in order.
 *   2. PUT each File to its `uploadUrl`, in parallel, with EXACTLY the returned headers. Those
 *      requests go to R2, not to our API: they bypass the Orval mutator and carry NO bearer token —
 *      the signature in the URL is the credential. XMLHttpRequest, not fetch, because only XHR
 *      reports upload progress. Content-Length is never set by hand (a forbidden header): the
 *      browser derives it from `File.size`, which is exactly the length signed in step 1.
 *
 * Lives in `src/api/` because it is HTTP and needs the generated client; the kernel
 * (`components/media/photo-items.ts`) receives it as a parameter.
 */
import { useCallback } from 'react';

import {
  PhotoUploadError,
  type PhotoUploadResult,
  type PhotoUploader,
} from '@/components/media/photo-upload-rules';

import { mapApiError } from './errors';
import { useCreatePhotoUploadUrlHttpControllerCreate } from './generated/catalog/catalog';
import type { PhotoUploadFileDtoContentType, PhotoUploadUrlDto } from './generated/model';

/**
 * Envelope code → per-photo state (ADR 0001 §4, `media:errors.*`). A 400 names the offending file
 * (`details[0].field` = `files.<i>.…`); that file gets the reason, the rest were simply not signed.
 */
function toPhotoUploadErrors(error: unknown, count: number): PhotoUploadError[] {
  const failed = Array.from({ length: count }, () => new PhotoUploadError('uploadFailed'));
  const mapped = mapApiError(error);
  if (mapped.kind !== 'fault') return failed;

  const detail = mapped.details?.[0];
  const index = Number(/^files\.(\d+)\./.exec(detail?.field ?? '')?.[1] ?? Number.NaN);
  const blame = (reason: PhotoUploadError) => {
    if (Number.isInteger(index) && index < count) failed[index] = reason;
    return failed;
  };
  switch (mapped.code) {
    case 'PHOTO.UNSUPPORTED_TYPE':
      return blame(new PhotoUploadError('unsupportedType'));
    case 'PHOTO.TOO_LARGE': {
      const maxBytes = detail?.maxBytes;
      return blame(
        new PhotoUploadError('tooLarge', typeof maxBytes === 'number' ? maxBytes : undefined),
      );
    }
    case 'PHOTO.STORAGE_UNAVAILABLE':
      return failed.map(() => new PhotoUploadError('storageUnavailable'));
    default:
      return failed;
  }
}

function putToStorage(
  ticket: PhotoUploadUrlDto,
  file: File,
  onProgress: (percent: number) => void,
  signal: AbortSignal | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    const done = (outcome: () => void) => {
      signal?.removeEventListener('abort', onAbort);
      outcome();
    };

    xhr.open(ticket.method, ticket.uploadUrl);
    for (const [name, value] of Object.entries(ticket.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    // 403 = expired URL / header mismatch; anything non-2xx is "upload failed, retry with a new URL".
    xhr.onload = () =>
      done(() =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new PhotoUploadError('uploadFailed')),
      );
    xhr.onerror = () => done(() => reject(new PhotoUploadError('uploadFailed')));
    xhr.onabort = () => done(() => reject(new PhotoUploadError('uploadFailed')));

    if (signal?.aborted) {
      reject(new PhotoUploadError('uploadFailed'));
      return;
    }
    signal?.addEventListener('abort', onAbort);
    xhr.send(file);
  });
}

/** The batch uploader the dress form runs on Save — one signing request + one PUT per file. */
export function usePhotoUploader(): PhotoUploader {
  // The form renders every failure per photo, so the app-wide "mutation failed" toast
  // (providers.tsx) is overridden with a no-op.
  const { mutateAsync } = useCreatePhotoUploadUrlHttpControllerCreate({
    mutation: { onError: () => {} },
  });

  return useCallback<PhotoUploader>(
    async (files, { onProgress, signal }) => {
      if (files.length === 0) return [];

      let uploads: PhotoUploadUrlDto[];
      try {
        ({ uploads } = await mutateAsync({
          data: {
            files: files.map((file) => ({
              // The field validated the type locally; the BE re-checks it either way.
              contentType: file.type as PhotoUploadFileDtoContentType,
              contentLength: file.size,
            })),
          },
        }));
      } catch (error) {
        return toPhotoUploadErrors(error, files.length).map((reason) => ({
          ok: false,
          error: reason,
        }));
      }

      return Promise.all(
        files.map(async (file, index): Promise<PhotoUploadResult> => {
          const ticket = uploads[index];
          if (!ticket) return { ok: false, error: new PhotoUploadError('uploadFailed') };
          try {
            await putToStorage(ticket, file, (percent) => onProgress(index, percent), signal);
            onProgress(index, 100);
            return { ok: true, url: ticket.url };
          } catch (error) {
            return {
              ok: false,
              error: error instanceof PhotoUploadError ? error : new PhotoUploadError('uploadFailed'),
            };
          }
        }),
      );
    },
    [mutateAsync],
  );
}
