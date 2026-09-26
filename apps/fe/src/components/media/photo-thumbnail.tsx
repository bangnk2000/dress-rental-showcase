import { ImageIcon } from 'lucide-react';
import { useState } from 'react';

import { PHOTO_WIDTH, photoUrl } from '@/lib/photo-url';
import { cn } from '@/lib/utils';

interface PhotoThumbnailProps {
  /** First photo of the dress, if it has one. */
  src?: string | null;
  className?: string;
}

/**
 * A dress photo at row size, or a neutral placeholder.
 *
 * Decorative on purpose (`alt=""`): every place that shows one also shows the dress code as text,
 * so announcing the image again is noise for a screen reader. Photos are staff-pasted links to
 * third-party hosts (`catalog/manage-dress`), so a dead URL is an ordinary state, not an error —
 * it degrades to the placeholder instead of a broken-image glyph. The failed URL is remembered
 * rather than a boolean, so a row that later receives a different photo tries again.
 */
export function PhotoThumbnail({ src: stored, className }: PhotoThumbnailProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // R2 photos render through the 160px Cloudflare Images variant; legacy links pass through.
  const src = stored ? photoUrl(stored, PHOTO_WIDTH.thumbnail) : null;
  const showImage = Boolean(src) && src !== failedSrc;

  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted',
        className,
      )}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <ImageIcon aria-hidden className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}
