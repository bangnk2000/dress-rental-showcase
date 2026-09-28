import { ArrowLeft, ArrowRight, ImageOff, Upload, X } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import {
  isRejectedPhoto,
  newPhotoId,
  revokePhotoPreview,
  type LocalPhoto,
  type PhotoItem,
} from './photo-items';
import { PhotoThumbnail } from './photo-thumbnail';
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  PHOTO_CONTENT_TYPES,
  PHOTO_LINK_PATTERN,
  isPhotoContentType,
  validatePhotoFile,
  type PhotoUploadError,
} from './photo-upload-rules';

interface PhotoListFieldProps {
  /** Photos in display order; the first is the cover. */
  value: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  /**
   * Upload progress (0–100) per photo id while the form is saving; null = not saving. While set,
   * the list is read-only: the form is turning exactly these photos into URLs.
   */
  progress?: Readonly<Record<string, number>> | null;
  max?: number;
  'aria-labelledby'?: string;
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

/**
 * The CMS photo field (docs/design/catalog/dress-photo-upload.md §4, §9): choose several photos,
 * paste links, reorder, remove. Chosen files are NOT uploaded here — they wait, as local previews
 * marked "not saved yet", until the form's Save uploads them all in one batch. States per photo:
 * stored (160 variant), waiting (local preview), uploading (preview + %, during Save), error (red +
 * message; a wrong type/size must be removed, a failed upload is retried by the next Save).
 *
 * Removing a photo only drops it from the list — nothing is deleted from storage (R5), and a photo
 * that was never uploaded never reached storage at all.
 */
export function PhotoListField({
  value,
  onChange,
  progress = null,
  max = MAX_PHOTOS,
  'aria-labelledby': ariaLabelledBy,
}: PhotoListFieldProps) {
  const { t } = useTranslation('media');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(false);
  const linkInputId = useId();

  const saving = progress !== null;
  const full = value.length >= max;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const slots = Math.max(0, max - value.length);
    const added = Array.from(files)
      .slice(0, slots)
      .map((file): LocalPhoto => {
        const invalid = validatePhotoFile(file);
        return {
          kind: 'local',
          id: newPhotoId(),
          file,
          previewUrl: createPreview(file),
          ...(invalid ? { error: invalid } : {}),
        };
      });
    onChange([...value, ...added]);
    // Choosing the same file again (after removing it) must fire change again.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target] as PhotoItem, next[index] as PhotoItem];
    onChange(next);
  }

  function removeAt(index: number) {
    const removed = value[index];
    if (removed) revokePhotoPreview(removed);
    onChange(value.filter((_, i) => i !== index));
  }

  function addLink() {
    const link = linkDraft.trim();
    if (!PHOTO_LINK_PATTERN.test(link)) {
      setLinkInvalid(true);
      return;
    }
    onChange([...value, { kind: 'stored', id: newPhotoId(), url: link }]);
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

  /** During Save every local photo is uploading — a failed one is being retried. */
  function uploadPercent(photo: PhotoItem): number | undefined {
    if (!saving || photo.kind !== 'local' || isRejectedPhoto(photo)) return undefined;
    return progress?.[photo.id] ?? 0;
  }

  function failureOf(photo: PhotoItem): PhotoUploadError | undefined {
    return photo.kind === 'local' && uploadPercent(photo) === undefined ? photo.error : undefined;
  }

  function renderTile(photo: PhotoItem) {
    if (photo.kind === 'stored' && !photo.previewUrl) {
      return <PhotoThumbnail src={photo.url} className="size-24" />;
    }
    const failed = failureOf(photo) !== undefined;
    const percent = uploadPercent(photo);
    return (
      <div
        className={cn(
          'relative flex size-24 items-center justify-center overflow-hidden rounded-md border bg-muted',
          failed && 'border-2 border-destructive',
        )}
      >
        {photo.previewUrl ? (
          <img
            src={photo.previewUrl}
            alt=""
            className={cn('size-full object-cover', percent !== undefined && 'opacity-50')}
          />
        ) : (
          <ImageOff aria-hidden className="size-5 text-muted-foreground" />
        )}
        {photo.kind === 'local' && !failed ? (
          <span
            role="status"
            className="absolute inset-x-0 bottom-0 bg-background/80 text-center text-xs font-medium"
          >
            {percent !== undefined ? t('photos.uploading', { percent }) : t('photos.pending')}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby={ariaLabelledBy} className="space-y-3">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {value.map((photo, index) => {
            const failure = failureOf(photo);
            return (
            // The id, not the index: reordering must move the <img>, not remount (and refetch) it.
            <li
              key={photo.id}
              className="w-24 space-y-1"
              data-status={photo.kind === 'stored' ? 'stored' : failure ? 'error' : 'pending'}
            >
              <div className="relative">
                {renderTile(photo)}
                {index === 0 ? (
                  <span className="absolute top-1 left-1 rounded bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                    {t('photos.cover')}
                  </span>
                ) : null}
              </div>
              {failure ? (
                <p role="alert" className="text-xs text-destructive">
                  {errorMessage(failure)}
                </p>
              ) : null}
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={saving || index === 0}
                  aria-label={t('photos.moveLeft', { index: index + 1 })}
                  onClick={() => move(index, -1)}
                >
                  <ArrowLeft />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={saving || index === value.length - 1}
                  aria-label={t('photos.moveRight', { index: index + 1 })}
                  onClick={() => move(index, 1)}
                >
                  <ArrowRight />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={saving}
                  aria-label={t('photos.remove', { index: index + 1 })}
                  onClick={() => removeAt(index)}
                >
                  <X />
                </Button>
              </div>
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
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => fileInputRef.current?.click()}
            >
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
              disabled={saving}
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
              disabled={saving}
              aria-invalid={linkInvalid || undefined}
              onChange={(event) => {
                setLinkDraft(event.target.value);
                setLinkInvalid(false);
              }}
              onKeyDown={handleLinkKeyDown}
            />
            <Button type="button" variant="outline" disabled={saving} onClick={addLink}>
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
