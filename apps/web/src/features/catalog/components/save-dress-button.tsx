'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * The approved design's heart. There is no session (apps/web/AGENTS.md deviation 1), so it only
 * toggles in place and is not persisted (docs/design/web/public-pages.md §3.1).
 */
export function SaveDressButton({ name, className, iconClassName }: { name: string; className?: string; iconClassName?: string }) {
  const t = useTranslations('catalog.card');
  const [saved, setSaved] = useState(false);
  return (
    <button
      type="button"
      aria-label={t('save', { name })}
      aria-pressed={saved}
      onClick={() => setSaved((s) => !s)}
      className={cn('flex items-center justify-center rounded-full bg-surface/85 text-primary backdrop-blur', className)}
    >
      <Heart className={cn(iconClassName, saved && 'fill-current')} aria-hidden />
    </button>
  );
}
