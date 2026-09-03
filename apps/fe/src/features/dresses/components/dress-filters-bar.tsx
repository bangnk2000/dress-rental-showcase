import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ListDressesHttpControllerListStatus } from '@/api/generated/model';
import type { CategoryDto } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Radix Select items cannot carry an empty value — sentinel for "all". */
const ALL_STATUSES = 'all';
const ALL_CATEGORIES = 'all';

interface DressFiltersBarProps {
  q: string | undefined;
  status: ListDressesHttpControllerListStatus | undefined;
  categoryId: string | undefined;
  categories: CategoryDto[];
  onSearch: (q: string) => void;
  onStatusChange: (status: ListDressesHttpControllerListStatus | undefined) => void;
  onCategoryChange: (categoryId: string | undefined) => void;
}

export function DressFiltersBar({
  q,
  status,
  categoryId,
  categories,
  onSearch,
  onStatusChange,
  onCategoryChange,
}: DressFiltersBarProps) {
  const { t } = useTranslation('dresses');

  // Local draft so typing does not refetch; the URL updates on submit
  // (Enter or the search button).
  const [draft, setDraft] = useState(q ?? '');

  // Re-sync the draft when the URL changes from elsewhere (back/forward).
  useEffect(() => {
    setDraft(q ?? '');
  }, [q]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(draft);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form role="search" className="flex items-center gap-2" onSubmit={handleSubmit}>
        <Input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('list.searchPlaceholder')}
          aria-label={t('list.searchPlaceholder')}
          className="w-64"
        />
        <Button type="submit" variant="secondary">
          {t('list.searchButton')}
        </Button>
      </form>
      <Select
        value={status ?? ALL_STATUSES}
        onValueChange={(value) =>
          onStatusChange(
            value === ALL_STATUSES
              ? undefined
              : (value as ListDressesHttpControllerListStatus),
          )
        }
      >
        <SelectTrigger aria-label={t('list.statusFilterLabel')} className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES}>{t('list.statusAll')}</SelectItem>
          {Object.values(ListDressesHttpControllerListStatus).map((value) => (
            <SelectItem key={value} value={value}>
              {t(`status.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={categoryId ?? ALL_CATEGORIES}
        onValueChange={(value) =>
          onCategoryChange(value === ALL_CATEGORIES ? undefined : value)
        }
      >
        <SelectTrigger aria-label={t('list.categoryFilterLabel')} className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CATEGORIES}>{t('list.categoryAll')}</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
