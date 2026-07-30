import { useTranslation } from 'react-i18next';

import { DressResponseDtoStatus } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';

/** Status enum → badge variant; labels come from the dresses namespace. */
const statusVariant = {
  [DressResponseDtoStatus.active]: 'default',
  [DressResponseDtoStatus.retired]: 'secondary',
} as const satisfies Record<DressResponseDtoStatus, 'default' | 'secondary'>;

export function DressStatusBadge({ status }: { status: DressResponseDtoStatus }) {
  const { t } = useTranslation('dresses');
  return <Badge variant={statusVariant[status]}>{t(`status.${status}`)}</Badge>;
}
