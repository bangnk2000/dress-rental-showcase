import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { TodayBoardRentalDto } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatVnd } from '@/lib/format';

/** Status → badge variant; 'out' stands out (the dress is with the customer). */
const statusVariant = {
  booked: 'secondary',
  out: 'default',
  returned: 'outline',
  cancelled: 'outline',
} as const;

interface TodayBoardSectionProps {
  title: string;
  emptyText: string;
  rentals: TodayBoardRentalDto[];
  /** Per-rental action buttons (pickup / return) supplied by the route. */
  renderActions?: (rental: TodayBoardRentalDto) => ReactNode;
}

export function TodayBoardSection({
  title,
  emptyText,
  rentals,
  renderActions,
}: TodayBoardSectionProps) {
  const { t } = useTranslation('today');
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">
        {title} <span className="font-normal text-muted-foreground">({rentals.length})</span>
      </h2>
      {rentals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {rentals.map((rental) => (
            <li key={rental.rentalId} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-medium break-words">{rental.customerName}</span>
                <Badge variant={statusVariant[rental.status]} className="shrink-0">
                  {t(`status.${rental.status}`)}
                </Badge>
              </div>
              {/* FR-RENT-14: only a booking still to hand out owes the deposit check. */}
              {rental.status === 'booked' ? (
                rental.depositCollected > 0 ? (
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {t('deposit.collected', { amount: formatVnd(rental.depositCollected) })}
                  </p>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-amber-500 text-amber-700 dark:text-amber-300"
                  >
                    {t('deposit.missing')}
                  </Badge>
                )
              ) : null}
              <p className="text-sm break-words text-muted-foreground">
                <a href={`tel:${rental.customerPhone}`}>{rental.customerPhone}</a>
                {' · '}
                {formatDate(rental.startDate)} – {formatDate(rental.endDate)}
              </p>
              <ul className="space-y-1">
                {rental.dresses.map((dress) => (
                  <li key={dress.dressId} className="text-sm">
                    <Link
                      to={`/dresses/${dress.dressId}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {dress.code}
                    </Link>
                    {' — '}
                    {dress.name}
                  </li>
                ))}
              </ul>
              {renderActions ? (
                <div className="flex flex-wrap justify-end gap-2">{renderActions(rental)}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
