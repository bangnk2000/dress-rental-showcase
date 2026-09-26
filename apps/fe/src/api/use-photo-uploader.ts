/**
 * Direct-to-R2 photo upload (docs/design/catalog/dress-photo-upload.md §2 CMS flow b–c).
 *
 *   1. POST /api/v1/photos/upload-urls through the generated client (the ONE API door: auth header,
 *      401 refresh) → { uploadUrl, headers, url }.
 *   2. PUT the File itself to `uploadUrl` with EXACTLY the returned headers. That request goes to
 *      R2, not to our API: it bypasses the Orval mutator and carries NO bearer token — the signature
 *      in the URL is the credential. XMLHttpRequest, not fetch, because only XHR reports upload
 *      progress. Content-Length is never set by hand (a forbidden header): the browser derives it
 *      from `File.size`, which is exactly the length signed in step 1.
 *
 * Lives in `src/api/` because it is HTTP and needs the generated client; the kernel field
 * (`components/media/photo-list-field.tsx`) receives it as a prop.
 */
import { useCallback } from 'react';

import { PhotoUploadError, type PhotoUploader } from '@/components/media/photo-upload-rules';

import { mapApiError } from './errors';
import { useCreatePhotoUploadUrlHttpControllerCreate } from './generated/catalog/catalog';
import type {
  CreatePhotoUploadUrlRequestDtoContentType,
  CreatePhotoUploadUrlResponseDto,
} from './generated/model';

/** Envelope code → per-photo state (ADR 0001 §4, `media:errors.*`). */
function toPhotoUploadError(error: unknown): PhotoUploadError {
  const mapped = mapApiError(error);
  if (mapped.kind === 'fault') {
    switch (mapped.code) {
      case 'PHOTO.UNSUPPORTED_TYPE':
        return new PhotoUploadError('unsupportedType');
      case 'PHOTO.TOO_LARGE': {
        const maxBytes = mapped.details?.[0]?.maxBytes;
        return new PhotoUploadError('tooLarge', typeof maxBytes === 'number' ? maxBytes : undefined);
      }
      case 'PHOTO.STORAGE_UNAVAILABLE':
        return new PhotoUploadError('storageUnavailable');
    }
  }
  return new PhotoUploadError('uploadFailed');
}

function putToStorage(
  ticket: CreatePhotoUploadUrlResponseDto,
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

/** The uploader `PhotoListField` expects — one call = one new upload URL + one PUT. */
export function usePhotoUploader(): PhotoUploader {
  // The field renders every failure per photo, so the app-wide "mutation failed" toast
  // (providers.tsx) is overridden with a no-op.
  const { mutateAsync } = useCreatePhotoUploadUrlHttpControllerCreate({
    mutation: { onError: () => {} },
  });

  return useCallback<PhotoUploader>(
    async (file, { onProgress, signal }) => {
      let ticket: CreatePhotoUploadUrlResponseDto;
      try {
        ticket = await mutateAsync({
          data: {
            // The field validated the type locally; the BE re-checks it either way.
            contentType: file.type as CreatePhotoUploadUrlRequestDtoContentType,
            contentLength: file.size,
          },
        });
      } catch (error) {
        throw toPhotoUploadError(error);
      }
      await putToStorage(ticket, file, onProgress, signal);
      onProgress(100);
      return ticket.url;
    },
    [mutateAsync],
  );
}
