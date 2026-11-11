import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useListDressesHttpControllerList } from '@/api/generated/catalog/catalog';
import { useCheckAvailabilityHttpControllerCheck } from '@/api/generated/rentals/rentals';
import { PhotoThumbnail } from '@/components/media/photo-thumbnail';
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
  /** Catalog standard deposit — pre-fills "Tiền cọc" at booking (FR-RENT-14). Edit omits it. */
  depositAmount?: number;
  /** First catalog photo, so the chosen row stays recognisable by sight. */
  photoUrl?: string;
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
  /** VND taken off the subtotal (FR-RENT-11), already parsed by the form; 0 = none. */
  discount: number;
  /**
   * When editing a rental (FR-RENT-13): its own bookings are what the edit replaces, so they
   * are not conflicts — without this every kept dress reads "Vướng lịch" against itself.
   */
  ignoreRentalId?: string;
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
  discount,
  ignoreRentalId,
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
              <li key={dress.id} className="flex items-center gap-2 p-2">
                <PhotoThumbnail src={dress.photoUrls[0]} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    <span className="font-medium">{dress.code}</span>{' '}
                    <span className="text-muted-foreground">{dress.name}</span>
                  </span>{' '}
                  {/* Own line: on a phone the name truncates, the price never does. The space
                      between the two blocks is invisible but keeps the text "name price". */}
                  <span className="block text-sm whitespace-nowrap tabular-nums">
                    {formatVnd(dress.rentalPrice)}
                  </span>
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
                      depositAmount: dress.depositAmount,
                      ...(dress.photoUrls[0] ? { photoUrl: dress.photoUrls[0] } : {}),
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
              {...(ignoreRentalId ? { ignoreRentalId } : {})}
            />
          ))}
          <li className="space-y-1 p-2 text-sm">
            <div className="flex items-center justify-between gap-2 font-medium">
              <span>{t('picker.total')}</span>
              <span className="tabular-nums">{formatVnd(total)}</span>
            </div>
            {/* The arithmetic behind the number staff will quote: subtotal, minus the discount,
                equals what the customer pays for the rental (deposit is separate). */}
            {discount > 0 ? (
              <>
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span>{t('picker.discount')}</span>
                  <span className="tabular-nums">−{formatVnd(discount)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 font-medium">
                  <span>{t('picker.payable')}</span>
                  <span className="tabular-nums">{formatVnd(Math.max(0, total - discount))}</span>
                </div>
              </>
            ) : null}
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
  ignoreRentalId,
}: {
  dress: SelectedDress;
  period: PickerPeriod | null;
  rejected: BlockedDresses['reason'] | null;
  onRemove: (dressId: string) => void;
  ignoreRentalId?: string;
}) {
  const { t } = useTranslation('rentals');
  const availability = useCheckAvailabilityHttpControllerCheck(
    dress.id,
    period ?? { startDate: '', endDate: '' },
    { query: { enabled: period !== null } },
  );
  const result = period ? availability.data : undefined;
  // The rental being edited is not its own competitor: its bookings drop out of the verdict.
  // A "busy" that came ONLY from them becomes free; a busy for another reason (retired) stays.
  const conflicts = (result?.conflicts ?? []).filter(
    (range) => ignoreRentalId === undefined || range.rentalId !== ignoreRentalId,
  );
  const available = result
    ? result.available || (result.conflicts.length > 0 && conflicts.length === 0)
    : undefined;
  const conflict = conflicts[0];

  return (
    <li className={cn('space-y-1 p-2', rejected && 'bg-destructive/5')}>
      <div className="flex flex-wrap items-center gap-2">
        <PhotoThumbnail src={dress.photoUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            <span className="font-medium">{dress.code}</span>{' '}
            <span className="text-muted-foreground">{dress.name}</span>
          </span>{' '}
          {/* Own line: on a phone the name truncates, the price never does. The space between
              the two blocks is invisible but keeps the text "name price". */}
          <span className="block text-sm whitespace-nowrap tabular-nums">
            {formatVnd(dress.rentalPrice)}
          </span>
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {available !== undefined ? (
            <Badge variant={available ? 'secondary' : 'destructive'}>
              {available ? t('picker.availability.free') : t('picker.availability.busy')}
            </Badge>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(dress.id)}>
            {t('picker.remove')}
          </Button>
        </div>
      </div>
      {/* Why it is busy: the blocking booking runs to blockedUntilDate, cleaning buffer included —
          the same number the dress calendar shades. */}
      {available === false && conflict ? (
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
