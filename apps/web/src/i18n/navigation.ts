// The ONLY navigation API features may use — plain next/link drops the locale (06 §4).
import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

// App Router query subscriptions use the same navigation door as locale-aware links.
export { useSearchParams } from 'next/navigation';
