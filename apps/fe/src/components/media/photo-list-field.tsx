import { ArrowLeft, ArrowRight, ImageOff, RotateCw, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { PhotoThumbnail } from './photo-thumbnail';
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  PHOTO_CONTENT_TYPES,
  PHOTO_LINK_PATTERN,
  PhotoUploadError,
  isPhotoContentType,
  validatePhotoFile,
  type PhotoUploader,
} from './photo-upload-rules';

interface PhotoListFieldProps {
  /** Photo URLs in display order; the first is the cover. Only FINISHED photos are ever in here. */
  value: string[];
  onChange: (urls: string[]) => void;
  /** Talks to the API + storage — injected, because the kernel may not import `src/api`. */
  upload: PhotoUploader;
  /** true while any photo is still uploading — the form disables Save on it (CMS flow d). */
  onUploadingChange?: (uploading: boolean) => void;
  max?: number;
  'aria-labelledby'?: string;
}

interface PendingPhoto {
  id: number;
  file: File;
  /** Local object URL, shown while the upload runs; revoked when the entry goes away. */
  previewUrl: string | null;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  url?: string;
  error?: PhotoUploadError;
}

const BYTES_PER_MB = 1024 * 1024;

function toMb(bytes: number): number {
  return Math.round((bytes / BYTES_PER_MB) * 10) / 10;
}

function createPreview(file: File): string | null {
  // jsdom (tests) has no createObjectURL; an unsupported type has nothing worth previewing.
  if (typeof URL.createObjectURL !== 'function' || !isPhotoContentType(file.type)) return null;
  return URL.createObjectURL(file);
}

function revokePreview(previewUrl: string | null): void {
  if (previewUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previewUrl);
}

/**
 * The CMS photo field (docs/design/catalog/dress-photo-upload.md §4): upload several photos straight
 * to storage, paste links, reorder, remove. States per photo: uploading (local preview + %), uploaded
 * (160 variant; ←/→ reorder, ✕ remove, "Bìa" on the first), error (message + remove, and retry
 * when a new attempt can succeed). At `max` photos the upload and link inputs give way to a notice.
 *
 * Finished uploads are committed to `value` in the order the files were CHOSEN, even when a later
 * file finishes first; a failed photo never holds the others back. Removing a photo only drops its
 * URL — nothing is deleted from storage (R5).
 */
export function PhotoListField({
  value,
  onChange,
  upload,
  onUploadingChange,
  max = MAX_PHOTOS,
  'aria-labelledby': ariaLabelledBy,
}: PhotoListFieldProps) {
  const { t } = useTranslation('media');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const controllers = useRef(new Map<number, AbortController>());
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(false);
  const linkInputId = useId();

  const patch = useCallback((id: number, changes: Partial<PendingPhoto>) => {
    setPending((prev) => prev.map((photo) => (photo.id === id ? { ...photo, ...changes } : photo)));
  }, []);

  const startUpload = useCallback(
    (id: number, file: File) => {
      const controller = new AbortController();
      controllers.current.set(id, controller);
      upload(file, {
        onProgress: (progress) => patch(id, { progress }),
        signal: controller.signal,
      })
        .then((url) => patch(id, { status: 'done', url, progress: 100 }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return; // removed / unmounted — nobody is looking
          patch(id, {
            status: 'error',
            error: error instanceof PhotoUploadError ? error : new PhotoUploadError('uploadFailed'),
          });
        })
        .finally(() => controllers.current.delete(id));
    },
    [upload, patch],
  );

  // Commit finished uploads in the order they were chosen: every 'done' entry ahead of the first
  // still-uploading one moves into `value`. Errors are skipped, not waited on.
  useEffect(() => {
    const ready: PendingPhoto[] = [];
    for (const photo of pending) {
      if (photo.status === 'uploading') break;
      if (photo.status === 'done') ready.push(photo);
    }
    if (ready.length === 0) return;
    onChange([...value, ...ready.map((photo) => photo.url as string)]);
    for (const photo of ready) revokePreview(photo.previewUrl);
    const readyIds = new Set(ready.map((photo) => photo.id));
    setPending((prev) => prev.filter((photo) => !readyIds.has(photo.id)));
  }, [pending, value, onChange]);

  const uploading = pending.some((photo) => photo.status === 'uploading');
  useEffect(() => {
    onUploadingChange?.(uploading);
    // Unmounting mid-upload (dialog closed) must not leave the form thinking it still uploads.
    return () => {
      if (uploading) onUploadingChange?.(false);
    };
  }, [uploading, onUploadingChange]);

  // Unmount: stop every PUT still in flight and release every preview.
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => {
    const inFlight = controllers.current;
    return () => {
      for (const controller of inFlight.values()) controller.abort();
      for (const photo of pendingRef.current) revokePreview(photo.previewUrl);
    };
  }, []);

  const total = value.length + pending.length;
  const full = total >= max;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const slots = Math.max(0, max - total);
    const entries: PendingPhoto[] = Array.from(files)
      .slice(0, slots)
      .map((file) => {
        const invalid = validatePhotoFile(file);
        return {
          id: nextId.current++,
          file,
          previewUrl: createPreview(file),
          progress: 0,
          status: invalid ? 'error' : 'uploading',
          ...(invalid ? { error: invalid } : {}),
        };
      });
    setPending((prev) => [...prev, ...entries]);
    for (const entry of entries) {
      if (entry.status === 'uploading') startUpload(entry.id, entry.file);
    }
    // Choosing the same file again (after removing it) must fire change again.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function retry(photo: PendingPhoto) {
    patch(photo.id, { status: 'uploading', progress: 0, error: undefined });
    startUpload(photo.id, photo.file); // the uploader requests a NEW upload URL (CMS flow c)
  }

  function removePending(photo: PendingPhoto) {
    controllers.current.get(photo.id)?.abort();
    revokePreview(photo.previewUrl);
    setPending((prev) => prev.filter((entry) => entry.id !== photo.id));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target] as string, next[index] as string];
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addLink() {
    const link = linkDraft.trim();
    if (!PHOTO_LINK_PATTERN.test(link)) {
      setLinkInvalid(true);
      return;
    }
    onChange([...value, link]);
    setLinkDraft('');
    setLinkInvalid(false);
  }

  function handleLinkKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter adds the link; it must not submit the surrounding dress form.
    if (event.key === 'Enter') {
      event.preventDefault();
      addLink();
    }
  }

  function errorMessage(error: PhotoUploadError): string {
    switch (error.reason) {
      case 'unsupportedType':
        return t('errors.unsupportedType');
      case 'tooLarge':
        return t('errors.tooLarge', { maxMb: toMb(error.maxBytes ?? MAX_PHOTO_BYTES) });
      case 'storageUnavailable':
        return t('errors.storageUnavailable');
      case 'uploadFailed':
        return t('errors.uploadFailed');
    }
  }

  return (
    <div role="group" aria-labelledby={ariaLabelledBy} className="space-y-3">
      {total > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {value.map((url, index) => (
            <li key={`${index}-${url}`} className="w-24 space-y-1">
              <div className="relative">
                <PhotoThumbnail src={url} className="size-24" />
                {index === 0 ? (
                  <span className="absolute top-1 left-1 rounded bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                    {t('photos.cover')}
                  </span>
                ) : null}
              </div>
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={index === 0}
                  aria-label={t('photos.moveLeft', { index: index + 1 })}
                  onClick={() => move(index, -1)}
                >
                  <ArrowLeft />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={index === value.length - 1}
                  aria-label={t('photos.moveRight', { index: index + 1 })}
                  onClick={() => move(index, 1)}
                >
                  <ArrowRight />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('photos.remove', { index: index + 1 })}
                  onClick={() => removeAt(index)}
                >
                  <X />
                </Button>
              </div>
            </li>
          ))}
          {pending.map((photo, offset) => {
            const index = value.length + offset + 1;
            return (
              <li key={photo.id} className="w-24 space-y-1" data-status={photo.status}>
                <div
                  className={cn(
                    'relative flex size-24 items-center justify-center overflow-hidden rounded-md border bg-muted',
                    photo.status === 'error' && 'border-2 border-destructive',
                  )}
                >
                  {photo.previewUrl ? (
                    <img
                      src={photo.previewUrl}
                      alt=""
                      className={cn(
                        'size-full object-cover',
                        photo.status !== 'error' && 'opacity-50',
                      )}
                    />
                  ) : (
                    <ImageOff aria-hidden className="size-5 text-muted-foreground" />
                  )}
                  {photo.status !== 'error' ? (
                    <span
                      role="status"
                      className="absolute inset-x-0 bottom-0 bg-background/80 text-center text-xs font-medium"
                    >
                      {t('photos.uploading', { percent: photo.progress })}
                    </span>
                  ) : null}
                </div>
                {photo.status === 'error' && photo.error ? (
                  <>
                    <p role="alert" className="text-xs text-destructive">
                      {errorMessage(photo.error)}
                    </p>
                    <div className="flex justify-end gap-1">
                      {photo.error.retryable ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t('photos.retry', { index })}
                          onClick={() => retry(photo)}
                        >
                          <RotateCw />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t('photos.remove', { index })}
                        onClick={() => removePending(photo)}
                      >
                        <X />
                      </Button>
                    </div>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {full ? (
        <p className="text-sm text-muted-foreground">{t('photos.limit', { max })}</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload />
              {t('photos.upload')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={PHOTO_CONTENT_TYPES.join(',')}
              aria-label={t('photos.fileInput')}
              tabIndex={-1}
              className="sr-only"
              onChange={(event) => handleFiles(event.target.files)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('photos.hint', { maxMb: toMb(MAX_PHOTO_BYTES) })}
          </p>
          <div className="flex gap-2">
            <label htmlFor={linkInputId} className="sr-only">
              {t('photos.linkInput')}
            </label>
            <Input
              id={linkInputId}
              // Not type="url": a half-typed draft must never trip native validation on the
              // surrounding form's submit.
              type="text"
              inputMode="url"
              autoComplete="off"
              placeholder={t('photos.linkPlaceholder')}
              value={linkDraft}
              aria-invalid={linkInvalid || undefined}
              onChange={(event) => {
                setLinkDraft(event.target.value);
                setLinkInvalid(false);
              }}
              onKeyDown={handleLinkKeyDown}
            />
            <Button type="button" variant="outline" onClick={addLink}>
              {t('photos.addLink')}
            </Button>
          </div>
          {linkInvalid ? (
            <p role="alert" className="text-sm text-destructive">
              {t('photos.linkInvalid')}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
