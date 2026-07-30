import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { RentalListItemDto } from '@/api/generated/model';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';

import { RentalStatusBadge } from './rental-status-badge';

export function RentalTable({ rentals }: { rentals: RentalListItemDto[] }) {
  const { t } = useTranslation('rentals');

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('list.columns.customer')}</TableHead>
          <TableHead>{t('list.columns.phone')}</TableHead>
          <TableHead>{t('list.columns.dresses')}</TableHead>
          <TableHead>{t('list.columns.period')}</TableHead>
          <TableHead>{t('list.columns.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rentals.map((rental) => (
          <TableRow key={rental.rentalId}>
            <TableCell className="font-medium">{rental.customerName}</TableCell>
            <TableCell>
              <a href={`tel:${rental.customerPhone}`}>{rental.customerPhone}</a>
            </TableCell>
            <TableCell>
              {rental.dresses.map((dress, index) => (
                <Fragment key={dress.dressId}>
                  {index > 0 ? ', ' : null}
                  <Link
                    to={`/dresses/${dress.dressId}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {dress.code}
                  </Link>
                </Fragment>
              ))}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDate(rental.startDate)} – {formatDate(rental.endDate)}
            </TableCell>
            <TableCell>
              <RentalStatusBadge status={rental.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
