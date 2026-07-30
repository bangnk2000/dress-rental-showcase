import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { DressResponseDto } from '@/api/generated/model';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatVnd } from '@/lib/format';

import { DressStatusBadge } from './dress-status-badge';

export function DressTable({ dresses }: { dresses: DressResponseDto[] }) {
  const { t } = useTranslation('dresses');

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('list.columns.code')}</TableHead>
          <TableHead>{t('list.columns.name')}</TableHead>
          <TableHead>{t('list.columns.size')}</TableHead>
          <TableHead className="text-right">{t('list.columns.rentalPrice')}</TableHead>
          <TableHead className="text-right">{t('list.columns.deposit')}</TableHead>
          <TableHead>{t('list.columns.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dresses.map((dress) => (
          <TableRow key={dress.id}>
            <TableCell>
              <Link
                to={`/dresses/${dress.id}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {dress.code}
              </Link>
            </TableCell>
            <TableCell>{dress.name}</TableCell>
            <TableCell>{dress.sizeLabel ?? '—'}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatVnd(dress.rentalPrice)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatVnd(dress.depositAmount)}
            </TableCell>
            <TableCell>
              <DressStatusBadge status={dress.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
