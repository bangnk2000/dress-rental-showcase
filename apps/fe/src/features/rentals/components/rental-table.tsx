import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { RentalListItemDto } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
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

interface RentalTableProps {
  rentals: RentalListItemDto[];
  /** When set, booked rows get a cancel action (the route owns the mutation). */
  onCancel?: (rental: RentalListItemDto) => void;
  /**
   * When set, EVERY row gets a money action. Not only settled rentals: since FR-PAY-02 the
   * deposit is recorded while the rental is still running, which is the point of the screen.
   */
  onShowPayments?: (rental: RentalListItemDto) => void;
}

export function RentalTable({ rentals, onCancel, onShowPayments }: RentalTableProps) {
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
          {onCancel || onShowPayments ? <TableHead /> : null}
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
            {onCancel || onShowPayments ? (
              <TableCell className="space-x-2 text-right">
                {onShowPayments ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onShowPayments(rental)}
                    aria-label={t('list.actions.paymentsFor', { customer: rental.customerName })}
                  >
                    {t('list.actions.payments')}
                  </Button>
                ) : null}
                {onCancel && rental.status === 'booked' ? (
                  <Button variant="outline" size="sm" onClick={() => onCancel(rental)}>
                    {t('list.actions.cancel')}
                  </Button>
                ) : null}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
