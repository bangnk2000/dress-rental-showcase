import 'server-only';

import { QueryClient } from '@tanstack/react-query';
import { cache } from 'react';

/** One QueryClient per request for server prefetch + HydrationBoundary — never shared. */
export const getQueryClient = cache(() => new QueryClient());
