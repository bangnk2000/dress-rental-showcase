'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRef, useState, type ReactNode } from 'react';

import type { PublicImage } from '@/api/mock/public-catalog';
import { cn } from '@/lib/utils';

/**
 * ONE carousel at every size — only its controls change (design/responsive.md §4 Product):
 * mobile = swipe + counter · md = thumbnails below · xl = thumbnail rail on the left.
 */
export function DressGallery({ images, overlay }: { images: PublicImage[]; overlay?: ReactNode }) {
  const t = useTranslations('catalog.detail');
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setCurrent(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (index: number) => {
    const el = trackRef.current;
    setCurrent(index);
    el?.scrollTo?.({ left: el.clientWidth * index, behavior: 'smooth' });
  };

  return (
    <div className="md:col-span-4 xl:col-span-7 xl:flex xl:flex-row-reverse xl:items-start xl:gap-gutter">
      <div className="relative xl:flex-1">
        <div
          ref={trackRef}
          onScroll={onScroll}
          aria-roledescription="carousel"
          aria-label={t('gallery')}
          className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none md:rounded-md"
        >
          {images.map((img, i) => (
            <div key={img.src} className="relative aspect-3/4 w-full shrink-0 snap-center overflow-hidden">
              <Image
                src={img.src}
                alt={img.alt}
                fill
                priority={i === 0}
                sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
        {overlay}
        <span
          aria-live="polite"
          className="absolute bottom-3 right-3 rounded-full bg-on-surface/60 px-2.5 py-1 text-label-sm text-surface md:hidden"
        >
          {t('counter', { current: current + 1, total: images.length })}
        </span>
      </div>
      <div role="tablist" aria-label={t('thumbnails')} className="mt-3 hidden gap-2 md:flex xl:mt-0 xl:w-20 xl:flex-col">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            role="tab"
            aria-selected={i === current}
            aria-label={t('showImage', { index: i + 1 })}
            onClick={() => go(i)}
            className={cn(
              'relative aspect-3/4 w-16 overflow-hidden rounded-default xl:w-full',
              i === current ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : 'opacity-70 hover:opacity-100',
            )}
          >
            <Image src={img.src} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
