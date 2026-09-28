import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';

import type { ListingWebStatus } from '../lib/web-status';

const VARIANT = {
  draft: 'outline',
  published: 'default',
  hidden: 'secondary',
} as const;

export function ListingStatusBadge({ status }: { status: ListingWebStatus }) {
  const { t } = useTranslation('listings');
  return <Badge variant={VARIANT[status]}>{t(`status.${status}`)}</Badge>;
}
