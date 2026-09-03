import { useTranslation } from 'react-i18next';

import { useListPriceHistoryHttpControllerList } from '@/api/generated/catalog/catalog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatVnd } from '@/lib/format';

/**
 * "Lịch sử giá" on the dress detail page (FR-CAT-06). Own (non-suspense) query: an error here
 * shows inline with a retry and must NOT take down the rest of the detail route.
 */
export function PriceHistorySection({ dressId }: { dressId: string }) {
  const { t } = useTranslation('dresses');
  const history = useListPriceHistoryHttpControllerList(dressId);

  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{t('priceHistory.title')}</h2>
      {history.isPending ? (
        <p className="text-sm text-muted-foreground">{t('priceHistory.loading')}</p>
      ) : history.isError ? (
        <div className="flex items-center gap-2">
          <p className="text-sm text-destructive">{t('priceHistory.error')}</p>
          <Button size="sm" variant="outline" onClick={() => void history.refetch()}>
            {t('priceHistory.retry')}
          </Button>
        </div>
      ) : history.data.data.length <= 1 ? (
        // ≥1 row is guaranteed (v1 at create + backfill) — a single row means "never changed".
        <p className="text-sm text-muted-foreground">
          {t('priceHistory.unchanged', {
            date: history.data.data[0] ? formatDate(history.data.data[0].changedAt) : '—',
          })}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('priceHistory.columns.date')}</TableHead>
                <TableHead className="text-right">{t('priceHistory.columns.rentalPrice')}</TableHead>
                <TableHead className="text-right">{t('priceHistory.columns.deposit')}</TableHead>
                <TableHead>{t('priceHistory.columns.changedBy')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.data.data.map((entry, index) => (
                <TableRow key={`${entry.changedAt}-${index}`}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(entry.changedAt)}
                    {index === 0 ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t('priceHistory.current')}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatVnd(entry.rentalPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatVnd(entry.depositAmount)}
                  </TableCell>
                  <TableCell>{entry.changedBy?.name ?? t('priceHistory.systemChange')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
