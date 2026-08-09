import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useListDressesHttpControllerList } from '@/api/generated/catalog/catalog';
import { useCheckAvailabilityHttpControllerCheck } from '@/api/generated/rentals/rentals';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatDate, formatVnd } from '@/lib/format';

/** The staff member's selection — form input state, not a server-state copy. */
export interface SelectedDress {
  id: string;
  code: string;
  name: string;
  rentalPrice: number;
}

/** The rental period, once both dates are filled and the range makes sense. */
export interface PickerPeriod {
  startDate: string;
  endDate: string;
}

/**
 * Which dresses the SERVER refused, and why (ADR 0001 payload). The rejection carries `dressIds`
 * precisely so the form can point at them instead of asking staff to guess which of four dresses
 * broke the booking.
 */
export interface BlockedDresses {
  dressIds: string[];
  reason: 'unavailable' | 'retired' | 'notFound';
}

interface DressPickerProps {
  selected: SelectedDress[];
  onAdd: (dress: SelectedDress) => void;
  onRemove: (dressId: string) => void;
  /** i18n key, rendered under the selection when the form has no dresses. */
  error: string | null;
  /** Dates from the form; null until both are filled and start ≤ end. */
  period: PickerPeriod | null;
  /** Set from the last rejection; cleared as soon as the selection or the dates change. */
  blocked: BlockedDresses | null;
}

/**
 * Search-and-add picker over the active catalog. No debounce on purpose:
 * ~200 dresses, staff tablet on LAN — a keystroke query is cheap and the
 * TanStack cache dedupes repeats.
 */
export function DressPicker({
  selected,
  onAdd,
  onRemove,
  error,
  period,
  blocked,
}: DressPickerProps) {
  const { t } = useTranslation('rentals');
  const [search, setSearch] = useState('');
  const trimmed = search.trim();

  const { data } = useListDressesHttpControllerList(
    { q: trimmed, status: 'active', limit: 10 },
    { query: { enabled: trimmed.length > 0 } },
  );

  const selectedIds = new Set(selected.map((dress) => dress.id));
  const results = (data?.data ?? []).filter((dress) => !selectedIds.has(dress.id));
  const translate = t as unknown as (key: string) => string;
  const total = selected.reduce((sum, dress) => sum + dress.rentalPrice, 0);

  return (
    <div className="grid gap-2">
      <Label htmlFor="dress-picker-search">{t('picker.title')}</Label>
      <Input
        id="dress-picker-search"
        type="search"
        placeholder={t('picker.searchPlaceholder')}
        autoComplete="off"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {trimmed.length > 0 ? (
        results.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {results.map((dress) => (
              <li key={dress.id} className="flex items-center justify-between gap-2 p-2">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{dress.code}</span>{' '}
                  <span className="text-muted-foreground">{dress.name}</span>{' '}
                  <span className="whitespace-nowrap">{formatVnd(dress.rentalPrice)}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onAdd({
                      id: dress.id,
                      code: dress.code,
                      name: dress.name,
                      rentalPrice: dress.rentalPrice,
                    });
                    setSearch('');
                  }}
                >
                  {t('picker.add')}
                </Button>
              </li>
            ))}
          </ul>
        ) : data !== undefined ? (
          <p className="text-sm text-muted-foreground">{t('picker.noResults')}</p>
        ) : null
      ) : null}
      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('picker.selectedEmpty')}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {selected.map((dress) => (
            <SelectedDressRow
              key={dress.id}
              dress={dress}
              period={period}
              rejected={blocked?.dressIds.includes(dress.id) ? blocked.reason : null}
              onRemove={onRemove}
            />
          ))}
          <li className="flex items-center justify-between gap-2 p-2 text-sm font-medium">
            <span>{t('picker.total')}</span>
            <span>{formatVnd(total)}</span>
          </li>
        </ul>
      )}
      {error ? <p className="text-sm text-destructive">{translate(error)}</p> : null}
    </div>
  );
}

/**
 * One chosen dress, checked against the dates already in the form. Own component so each dress can
 * run its own query — the alternative is telling staff "some dress is booked" only after they
 * submit, which is what this replaces. Selected dresses only: the search results would cost a query
 * per keystroke per row for an answer nobody asked for yet.
 */
function SelectedDressRow({
  dress,
  period,
  rejected,
  onRemove,
}: {
  dress: SelectedDress;
  period: PickerPeriod | null;
  rejected: BlockedDresses['reason'] | null;
  onRemove: (dressId: string) => void;
}) {
  const { t } = useTranslation('rentals');
  const availability = useCheckAvailabilityHttpControllerCheck(
    dress.id,
    period ?? { startDate: '', endDate: '' },
    { query: { enabled: period !== null } },
  );
  const result = period ? availability.data : undefined;
  const conflict = result?.conflicts[0];

  return (
    <li className={cn('space-y-1 p-2', rejected && 'bg-destructive/5')}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">
          <span className="font-medium">{dress.code}</span>{' '}
          <span className="text-muted-foreground">{dress.name}</span>{' '}
          <span className="whitespace-nowrap">{formatVnd(dress.rentalPrice)}</span>
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {result ? (
            <Badge variant={result.available ? 'secondary' : 'destructive'}>
              {result.available ? t('picker.availability.free') : t('picker.availability.busy')}
            </Badge>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(dress.id)}>
            {t('picker.remove')}
          </Button>
        </div>
      </div>
      {/* Why it is busy: the blocking booking runs to blockedUntilDate, cleaning buffer included —
          the same number the dress calendar shades. */}
      {result && !result.available && conflict ? (
        <p className="text-sm text-destructive">
          {t('picker.availability.busyUntil', {
            date: formatDate(conflict.blockedUntilDate),
          })}
        </p>
      ) : null}
      {rejected ? (
        <p className="text-sm font-medium text-destructive">
          {t(`picker.rejected.${rejected}`)}
        </p>
      ) : null}
    </li>
  );
}
