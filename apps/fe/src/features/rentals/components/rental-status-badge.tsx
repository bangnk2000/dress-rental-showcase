import { useTranslation } from 'react-i18next';

import { RentalListItemDtoStatus } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';

/** Status enum → badge variant; labels come from the rentals namespace. */
const statusVariant = {
  [RentalListItemDtoStatus.booked]: 'secondary',
  [RentalListItemDtoStatus.out]: 'default',
  [RentalListItemDtoStatus.returned]: 'outline',
  [RentalListItemDtoStatus.cancelled]: 'outline',
} as const satisfies Record<
  RentalListItemDtoStatus,
  'default' | 'secondary' | 'outline'
>;

export function RentalStatusBadge({ status }: { status: RentalListItemDtoStatus }) {
  const { t } = useTranslation('rentals');
  return <Badge variant={statusVariant[status]}>{t(`status.${status}`)}</Badge>;
}
