import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useListDressesHttpControllerList } from '@/api/generated/catalog/catalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatVnd } from '@/lib/format';

/** The staff member's selection — form input state, not a server-state copy. */
export interface SelectedDress {
  id: string;
  code: string;
  name: string;
  rentalPrice: number;
}

interface DressPickerProps {
  selected: SelectedDress[];
  onAdd: (dress: SelectedDress) => void;
  onRemove: (dressId: string) => void;
  /** i18n key, rendered under the selection when the form has no dresses. */
  error: string | null;
}

/**
 * Search-and-add picker over the active catalog. No debounce on purpose:
 * ~200 dresses, staff tablet on LAN — a keystroke query is cheap and the
 * TanStack cache dedupes repeats.
 */
export function DressPicker({ selected, onAdd, onRemove, error }: DressPickerProps) {
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
            <li key={dress.id} className="flex items-center justify-between gap-2 p-2">
              <span className="min-w-0 truncate">
                <span className="font-medium">{dress.code}</span>{' '}
                <span className="text-muted-foreground">{dress.name}</span>{' '}
                <span className="whitespace-nowrap">{formatVnd(dress.rentalPrice)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(dress.id)}
              >
                {t('picker.remove')}
              </Button>
            </li>
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
