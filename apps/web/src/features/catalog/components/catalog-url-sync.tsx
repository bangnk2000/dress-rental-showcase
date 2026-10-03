'use client';

import { useEffect } from 'react';

import { useSearchParams } from '@/i18n/navigation';

/** Subscribe below Suspense so the full catalogue can keep its static/ISR server HTML. */
export function CatalogUrlSync({ onChange }: { onChange: (search: string) => void }) {
  const search = useSearchParams().toString();
  useEffect(() => { onChange(search); }, [search, onChange]);
  return null;
}
