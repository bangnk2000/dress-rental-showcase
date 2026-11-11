import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { DressResponseDto } from '@/api/generated/model';
import { PhotoThumbnail } from '@/components/media/photo-thumbnail';
import { Button } from '@/components/ui/button';
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

interface DressTableProps {
  dresses: DressResponseDto[];
  /** id → name, built from the (tiny, cached) GET /categories list — no name on each dress row. */
  categoryNameById: Map<string, string>;
  /** When set, every row gets a duplicate action (FR-CAT-08) — the route owns the dialog. */
  onDuplicate?: (dress: DressResponseDto) => void;
}

export function DressTable({ dresses, categoryNameById, onDuplicate }: DressTableProps) {
  const { t } = useTranslation('dresses');

  return (
    // Phone (cms-mobile-ux D2/D3): each dress is a block — the thumbnail on the left spans the
    // code and name lines; size and price, then status and the action, sit beside it. Category
    // and deposit are hidden on phones (still shown on the dress detail page).
    <Table stacked>
      <TableHeader>
        <TableRow>
          {/* A dress shop recognises stock by sight; the header would only add noise. */}
          <TableHead className="w-14">
            <span className="sr-only">{t('list.columns.photo')}</span>
          </TableHead>
          <TableHead>{t('list.columns.code')}</TableHead>
          <TableHead>{t('list.columns.name')}</TableHead>
          <TableHead>{t('list.columns.size')}</TableHead>
          <TableHead>{t('list.columns.category')}</TableHead>
          <TableHead className="text-right">{t('list.columns.rentalPrice')}</TableHead>
          <TableHead className="text-right">{t('list.columns.deposit')}</TableHead>
          <TableHead>{t('list.columns.status')}</TableHead>
          {onDuplicate ? (
            <TableHead className="w-0">
              <span className="sr-only">{t('list.columns.actions')}</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {dresses.map((dress) => (
          <TableRow key={dress.id} className="max-md:grid-cols-[2.5rem_1fr_1fr]">
            <TableCell className="max-md:row-span-2">
              <PhotoThumbnail src={dress.photoUrls[0]} />
            </TableCell>
            <TableCell stack="title">
              <Link
                to={`/dresses/${dress.id}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {dress.code}
              </Link>
            </TableCell>
            <TableCell stack="full">
              {dress.name}
            </TableCell>
            <TableCell label={t('list.columns.size')} className="max-md:col-start-2">
              {dress.sizeLabel ?? '—'}
            </TableCell>
            <TableCell className="max-md:hidden">
              {dress.categoryId ? (categoryNameById.get(dress.categoryId) ?? '—') : '—'}
            </TableCell>
            <TableCell label={t('list.columns.rentalPrice')} className="text-right tabular-nums">
              {formatVnd(dress.rentalPrice)}
            </TableCell>
            <TableCell className="text-right tabular-nums max-md:hidden">
              {formatVnd(dress.depositAmount)}
            </TableCell>
            <TableCell label={t('list.columns.status')} className="max-md:col-start-2">
              <DressStatusBadge status={dress.status} />
            </TableCell>
            {onDuplicate ? (
              <TableCell
                stack="actions"
                className="text-right max-md:col-start-2"
              >
                {/* The visible label repeats down the list, so the code rides in the accessible name. */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDuplicate(dress)}
                  aria-label={t('list.actions.duplicateFor', { code: dress.code })}
                >
                  {t('list.actions.duplicate')}
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
