/**
 * The photo field's value (docs/design/catalog/dress-photo-upload.md §9): photos the dress already
 * points at, and files chosen in this form but NOT uploaded yet. Nothing reaches R2 until the form
 * is saved — cancelling the form leaves no orphan object behind (R5 never deletes one).
 */
import {
  PHOTO_LINK_PATTERN,
  type PhotoUploadError,
  type PhotoUploader,
} from './photo-upload-rules';

/** A URL the dress stores (R2 or a pasted link). */
export interface StoredPhoto {
  kind: 'stored';
  id: string;
  url: string;
  /**
   * Local object URL of a file uploaded by THIS form: the field keeps showing it instead of
   * fetching the photo straight back from storage.
   */
  previewUrl?: string | null;
}

/** A chosen file, uploaded on Save. `error` = why it cannot be (or was not) uploaded. */
export interface LocalPhoto {
  kind: 'local';
  id: string;
  file: File;
  previewUrl: string | null;
  error?: PhotoUploadError;
}

export type PhotoItem = StoredPhoto | LocalPhoto;

let nextId = 1;
export function newPhotoId(): string {
  return `photo-${nextId++}`;
}

export function toPhotoItems(urls: readonly string[]): PhotoItem[] {
  return urls.map((url) => ({ kind: 'stored', id: newPhotoId(), url }));
}

export function isLocalPhoto(item: PhotoItem): item is LocalPhoto {
  return item.kind === 'local';
}

/** The `photoUrls` to send — call after `uploadLocalPhotos` succeeded (no local item left). */
export function photoUrlsOf(items: readonly PhotoItem[]): string[] {
  return items.flatMap((item) => (item.kind === 'stored' ? [item.url] : []));
}

/** A local photo that no upload can fix (wrong type / too large) — only removing it helps. */
export function isRejectedPhoto(item: PhotoItem): boolean {
  return item.kind === 'local' && item.error !== undefined && !item.error.retryable;
}

export function isValidPhotoLink(item: PhotoItem): boolean {
  return item.kind === 'local' || PHOTO_LINK_PATTERN.test(item.url);
}

export function revokePhotoPreview(item: PhotoItem): void {
  if (item.previewUrl && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(item.previewUrl);
  }
}

export function revokePhotoPreviews(items: readonly PhotoItem[]): void {
  for (const item of items) revokePhotoPreview(item);
}

/**
 * Save step 1: upload every local photo in one batch. Uploaded ones become stored photos (same id,
 * same place in the order, preview kept); failed ones stay local with their error, so the next
 * Save uploads ONLY those. `ok` = nothing is left to upload.
 */
export async function uploadLocalPhotos(
  items: readonly PhotoItem[],
  upload: PhotoUploader,
  options: { onProgress: (id: string, percent: number) => void; signal?: AbortSignal },
): Promise<{ items: PhotoItem[]; ok: boolean }> {
  const locals = items.filter(isLocalPhoto);
  if (locals.length === 0) return { items: [...items], ok: true };

  const results = await upload(
    locals.map((photo) => photo.file),
    {
      onProgress: (index, percent) => {
        const photo = locals[index];
        if (photo) options.onProgress(photo.id, percent);
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  const resultById = new Map(locals.map((photo, index) => [photo.id, results[index]]));

  let ok = true;
  const next = items.map((item): PhotoItem => {
    const result = resultById.get(item.id);
    if (item.kind !== 'local' || !result) return item;
    if (result.ok) {
      return { kind: 'stored', id: item.id, url: result.url, previewUrl: item.previewUrl };
    }
    ok = false;
    return { ...item, error: result.error };
  });
  return { items: next, ok };
}
