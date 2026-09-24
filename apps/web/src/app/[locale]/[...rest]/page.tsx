import { notFound } from 'next/navigation';

// Unknown paths under a locale render [locale]/not-found.tsx (localized) instead of Next's default.
export default function CatchAllPage() {
  notFound();
}
