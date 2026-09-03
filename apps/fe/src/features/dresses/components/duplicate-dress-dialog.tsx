import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
import {
  getListDressesHttpControllerListQueryKey,
  useDuplicateDressHttpControllerDuplicate,
} from '@/api/generated/catalog/catalog';
import type { DressResponseDto } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { duplicateBaseOf } from '../schemas/dress-form.schema';
import { SizeOptionGroup } from './size-option-group';

interface DuplicateDressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The dress being copied — everything but the code and the size comes from it. */
  dress: DressResponseDto;
}

/**
 * FR-CAT-08: the same model in another size. The server assigns the code (`<base>_1`, `_2`, …),
 * so the only question the dialog asks is the size; on success it lands on the copy, where the
 * usual edit dialog covers anything else that differs.
 */
export function DuplicateDressDialog({ open, onOpenChange, dress }: DuplicateDressDialogProps) {
  const { t } = useTranslation('dresses');
  const { t: tCommon } = useTranslation('common'); // shared verbs only
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const sizeLabelId = useId();
  const [size, setSize] = useState(dress.sizeLabel ?? '');

  // Re-prime per open: the source's size is the default, since most copies keep it.
  useEffect(() => {
    if (open) setSize(dress.sizeLabel ?? '');
  }, [open, dress.sizeLabel]);

  async function invalidateList(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: getListDressesHttpControllerListQueryKey(),
    });
  }

  // One designed state per outcome code (ADR 0001 §4). Defining onError here also overrides the
  // global "mutation failed" toast.
  const duplicateDress = useDuplicateDressHttpControllerDuplicate({
    mutation: {
      onSuccess: async (copy) => {
        await invalidateList();
        toast.success(t('duplicate.success', { code: copy.code }));
        onOpenChange(false);
        void navigate(`/dresses/${copy.id}`);
      },
      onError: async (error) => {
        const mapped = mapApiError(error);
        if (mapped.kind !== 'outcome') {
          toast.error(t('duplicate.error')); // a fault: retry is the only answer
          return;
        }
        switch (mapped.status) {
          case 'rejected_dress_not_found':
            // The source vanished under us: nothing left to copy from.
            await invalidateList();
            toast.error(t('errors.notFound'));
            onOpenChange(false);
            return;
          case 'rejected_dress_code_taken':
            // The numbering race lost more times than the server retries — a tap again wins.
            toast.error(t('duplicate.codeTaken', { code: String(mapped.dressCode ?? '') }));
            return;
          default:
            toast.error(t('duplicate.error'));
        }
      },
    },
  });

  const base = duplicateBaseOf(dress.code);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('duplicate.title', { code: dress.code })}</DialogTitle>
          <DialogDescription>{t('duplicate.description', { base })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label id={sizeLabelId}>{t('duplicate.size')}</Label>
          <SizeOptionGroup value={size} onChange={setSize} aria-labelledby={sizeLabelId} />
          <p className="text-sm text-muted-foreground">{t('form.sizeHint')}</p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {tCommon('actions.cancel')}
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={duplicateDress.isPending}
            onClick={() =>
              // The size is always stated: the source's own label when untouched, null when cleared.
              duplicateDress.mutate({ id: dress.id, data: { sizeLabel: size ? size : null } })
            }
          >
            {t('duplicate.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
