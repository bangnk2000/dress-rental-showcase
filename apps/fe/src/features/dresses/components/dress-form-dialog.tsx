import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  getListDressesHttpControllerListQueryKey,
  useCreateDressHttpControllerCreate,
} from '@/api/generated/catalog/catalog';
import type { CreateDressRequestDto } from '@/api/generated/model';
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
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { isConflictError } from '../lib/is-conflict-error';
import {
  dressFormDefaults,
  dressFormSchema,
  type DressFormValues,
} from '../schemas/dress-form.schema';
import { DressFormMessage } from './dress-form-message';

interface DressFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Form values (strings) → request body; blank optional fields are omitted. */
function toCreateDressRequest(values: DressFormValues): CreateDressRequestDto {
  return {
    code: values.code,
    name: values.name,
    rentalPrice: Number(values.rentalPrice),
    depositAmount: Number(values.depositAmount),
    ...(values.sizeLabel ? { sizeLabel: values.sizeLabel } : {}),
    ...(values.notes ? { notes: values.notes } : {}),
  };
}

export function DressFormDialog({ open, onOpenChange }: DressFormDialogProps) {
  const { t } = useTranslation('dresses');
  const { t: tCommon } = useTranslation('common'); // shared verbs only
  const queryClient = useQueryClient();

  const form = useForm<DressFormValues>({
    resolver: zodResolver(dressFormSchema),
    defaultValues: dressFormDefaults,
  });

  function handleOpenChange(next: boolean) {
    if (!next) form.reset();
    onOpenChange(next);
  }

  // TError widened from the generated default (void) so onError can inspect
  // the 409 duplicate-code case. Defining onError here also overrides the
  // global "mutation failed" toast for this mutation.
  const createDress = useCreateDressHttpControllerCreate<unknown>({
    mutation: {
      onSuccess: async () => {
        // Invalidate EVERY cached list variation: the parameterless generated
        // key is a prefix of all filtered/paginated list keys.
        await queryClient.invalidateQueries({
          queryKey: getListDressesHttpControllerListQueryKey(),
        });
        toast.success(t('form.success'));
        handleOpenChange(false);
      },
      onError: (error) => {
        if (isConflictError(error)) {
          // 409 = duplicate code; the contract has no typed body for it.
          form.setError('code', { message: 'form.errors.duplicateCode' });
          return;
        }
        toast.error(t('form.error'));
      },
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    createDress.mutate({ data: toCreateDressRequest(values) });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('form.title')}</DialogTitle>
          <DialogDescription>{t('form.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(event) => void onSubmit(event)} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.code')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <DressFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.name')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <DressFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sizeLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.sizeLabel')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <DressFormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="rentalPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.fields.rentalPrice')}</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" autoComplete="off" {...field} />
                    </FormControl>
                    <DressFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="depositAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.fields.depositAmount')}</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" autoComplete="off" {...field} />
                    </FormControl>
                    <DressFormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.notes')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <DressFormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {tCommon('actions.cancel')}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createDress.isPending}>
                {tCommon('actions.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
