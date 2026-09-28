import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { mapApiError } from '@/api/errors';
import {
  getListDressesHttpControllerListQueryKey,
  getListDressesHttpControllerListQueryOptions,
  useListDressesHttpControllerList,
  useSetListingDressesHttpControllerSetDresses,
} from '@/api/generated/catalog/catalog';
import type { DressResponseDto, ListingDressDto, ListingDto } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatVnd } from '@/lib/format';

import { useRefreshListings } from '../hooks/use-refresh-listings';

/** The code a duplicate is numbered from (mirrors DressCode.baseOf on the API, FR-CAT-08). */
function groupBaseOf(code: string): string {
  return code.replace(/_[0-9]+$/, '');
}

function isInGroup(code: string, base: string): boolean {
  const upper = code.toUpperCase();
  const upperBase = base.toUpperCase();
  return upper === upperBase || new RegExp(`^${escapeRegExp(upperBase)}_[0-9]+$`).test(upper);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toListingDress(dress: DressResponseDto): ListingDressDto {
  return {
    id: dress.id,
    code: dress.code,
    name: dress.name,
    sizeLabel: dress.sizeLabel,
    rentalPrice: dress.rentalPrice,
    status: dress.status,
  };
}

function sameIds(a: readonly ListingDressDto[], b: readonly ListingDressDto[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((dress) => dress.id));
  return b.every((dress) => ids.has(dress.id));
}

/**
 * "Size & váy" (spec §3): the dresses behind the listing. Edits a DRAFT of the attached set, then
 * saves it in one PUT with the COMPLETE list (the endpoint replaces the set). Retired dresses may be
 * attached — they just never count on the web; the table says which is which.
 */
export function ListingDressesSection({ listing }: { listing: ListingDto }) {
  const { t } = useTranslation('listings');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const refreshListings = useRefreshListings();
  const [draft, setDraft] = useState<ListingDressDto[]>(listing.dresses);
  const [search, setSearch] = useState('');
  const [groupPending, setGroupPending] = useState<string | null>(null);
  const trimmed = search.trim();

  const { data } = useListDressesHttpControllerList(
    { q: trimmed, limit: 10 },
    { query: { enabled: trimmed.length > 0 } },
  );
  const draftIds = new Set(draft.map((dress) => dress.id));
  const results = (data?.data ?? []).filter((dress) => !draftIds.has(dress.id));

  const dirty = !sameIds(draft, listing.dresses);
  const prices = new Set(draft.map((dress) => dress.rentalPrice));

  const setDresses = useSetListingDressesHttpControllerSetDresses({
    mutation: { onError: () => undefined },
  });

  function add(dresses: readonly ListingDressDto[]) {
    setDraft((prev) => {
      const ids = new Set(prev.map((dress) => dress.id));
      return [...prev, ...dresses.filter((dress) => !ids.has(dress.id))];
    });
  }

  /** `<code>` + every `<code>_<n>` of the group — the sizes of one model (FR-CAT-08). */
  async function attachGroup(dress: DressResponseDto) {
    const base = groupBaseOf(dress.code);
    setGroupPending(dress.id);
    try {
      const page = await queryClient.fetchQuery(
        getListDressesHttpControllerListQueryOptions({ q: base, limit: 100 }),
      );
      const group = page.data.filter((candidate) => isInGroup(candidate.code, base));
      add((group.length > 0 ? group : [dress]).map(toListingDress));
      setSearch('');
    } catch {
      toast.error(t('form.error'));
    } finally {
      setGroupPending(null);
    }
  }

  async function save() {
    const touched = [...listing.dresses, ...draft].map((dress) => dress.id);
    try {
      await setDresses.mutateAsync({
        id: listing.id,
        data: { dressIds: draft.map((dress) => dress.id) },
      });
    } catch (error) {
      const mapped = mapApiError(error);
      if (mapped.kind === 'outcome' && mapped.status === 'rejected_dress_not_found') {
        // The payload names the vanished dresses: drop exactly those, then refetch the picker.
        const gone = new Set(Array.isArray(mapped.dressIds) ? (mapped.dressIds as string[]) : []);
        setDraft((prev) => prev.filter((dress) => !gone.has(dress.id)));
        toast.error(t('errors.dressNotFound'));
        await queryClient.invalidateQueries({
          queryKey: getListDressesHttpControllerListQueryKey(),
        });
        return;
      }
      if (mapped.kind === 'outcome' && mapped.status === 'rejected_listing_not_found') {
        toast.error(t('errors.notFound'));
        void navigate('/website');
        await refreshListings({ dressIds: touched });
        return;
      }
      toast.error(t('form.error'));
      return;
    }
    await refreshListings({ listingId: listing.id, dressIds: touched });
    toast.success(t('dresses.saveSuccess'));
  }

  return (
    <section className="space-y-3" aria-labelledby="listing-dresses-title">
      <h2 id="listing-dresses-title" className="text-base font-semibold">
        {t('dresses.title')}
      </h2>
      <div className="grid gap-2">
        <Label htmlFor="listing-dress-search">{t('dresses.searchLabel')}</Label>
        <Input
          id="listing-dress-search"
          type="search"
          autoComplete="off"
          placeholder={t('dresses.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {trimmed.length > 0 ? (
          results.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {results.map((dress) => (
                <li key={dress.id} className="flex flex-wrap items-center gap-2 p-2">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{dress.code}</span>{' '}
                    <span className="text-muted-foreground">{dress.name}</span>{' '}
                    <span>{dress.sizeLabel ?? t('dresses.freesize')}</span>{' '}
                    <span className="whitespace-nowrap">{formatVnd(dress.rentalPrice)}</span>
                  </span>
                  {dress.status === 'retired' ? (
                    <Badge variant="secondary">{t('dresses.status.retired')}</Badge>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={t('dresses.addFor', { code: dress.code })}
                    onClick={() => {
                      add([toListingDress(dress)]);
                      setSearch('');
                    }}
                  >
                    {t('dresses.add')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={groupPending !== null}
                    aria-label={t('dresses.attachGroupFor', { code: groupBaseOf(dress.code) })}
                    onClick={() => void attachGroup(dress)}
                  >
                    {groupPending === dress.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    {t('dresses.attachGroup')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : data !== undefined ? (
            <p className="text-sm text-muted-foreground">{t('dresses.noResults')}</p>
          ) : null
        ) : null}
      </div>
      {prices.size > 1 ? (
        <p
          role="status"
          className="rounded-md border border-yellow-300 bg-yellow-50 p-2 text-sm text-yellow-900"
        >
          {t('dresses.priceMismatch')}
        </p>
      ) : null}
      {draft.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('dresses.empty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('dresses.columns.size')}</TableHead>
              <TableHead>{t('dresses.columns.code')}</TableHead>
              <TableHead>{t('dresses.columns.name')}</TableHead>
              <TableHead className="text-right">{t('dresses.columns.rentalPrice')}</TableHead>
              <TableHead>{t('dresses.columns.status')}</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">{t('dresses.columns.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draft.map((dress) => (
              <TableRow key={dress.id}>
                <TableCell>{dress.sizeLabel ?? t('dresses.freesize')}</TableCell>
                <TableCell>
                  <Link to={`/dresses/${dress.id}`} className="font-medium hover:underline">
                    {dress.code}
                  </Link>
                </TableCell>
                <TableCell>{dress.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatVnd(dress.rentalPrice)}
                </TableCell>
                <TableCell>
                  <Badge variant={dress.status === 'active' ? 'default' : 'secondary'}>
                    {t(`dresses.status.${dress.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t('dresses.removeFor', { code: dress.code })}
                    onClick={() =>
                      setDraft((prev) => prev.filter((candidate) => candidate.id !== dress.id))
                    }
                  >
                    {t('dresses.remove')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="flex items-center justify-end gap-2">
        {dirty ? <span className="text-sm text-muted-foreground">{t('dresses.unsaved')}</span> : null}
        <Button
          type="button"
          disabled={!dirty || setDresses.isPending}
          onClick={() => void save()}
        >
          {setDresses.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {t('dresses.save')}
        </Button>
      </div>
    </section>
  );
}
