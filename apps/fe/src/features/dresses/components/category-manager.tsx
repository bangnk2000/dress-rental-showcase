import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
import {
  getListCategoriesHttpControllerListQueryKey,
  getListDressesHttpControllerListQueryKey,
  useCreateCategoryHttpControllerCreate,
  useDeleteCategoryHttpControllerRemove,
  useRenameCategoryHttpControllerRename,
} from '@/api/generated/catalog/catalog';
import type { CategoryDto } from '@/api/generated/model';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Category upkeep lives ON the catalog screen (dress-category spec §6 derived #5): 3-10 labels
 * do not deserve a route. Create/rename are any-staff; DELETE is owner-only on the server — the
 * button stays visible and the named rejection explains, rather than silently hiding a
 * capability staff may need to ask the owner for.
 */
export function CategoryManager({ categories }: { categories: CategoryDto[] }) {
  const { t } = useTranslation('dresses');
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<CategoryDto | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CategoryDto | null>(null);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getListCategoriesHttpControllerListQueryKey() }),
      // Renames change the names dress rows display; deletes can race an assignment.
      queryClient.invalidateQueries({ queryKey: getListDressesHttpControllerListQueryKey() }),
    ]);

  const nameTakenOrToast = (error: unknown, fallback: string) => {
    const mapped = mapApiError(error);
    if (mapped.kind === 'outcome' && mapped.status === 'rejected_category_name_taken') {
      return t('categories.errors.nameTaken', { name: String(mapped.name ?? '') });
    }
    toast.error(fallback);
    return null;
  };

  const create = useCreateCategoryHttpControllerCreate({
    mutation: {
      onSuccess: async () => {
        setDraft('');
        setCreateError(null);
        await invalidate();
      },
      onError: (error) => {
        setCreateError(nameTakenOrToast(error, t('categories.errors.generic')));
      },
    },
  });

  const rename = useRenameCategoryHttpControllerRename({
    mutation: {
      onSuccess: async () => {
        setRenameTarget(null);
        await invalidate();
      },
      onError: (error) => {
        const message = nameTakenOrToast(error, t('categories.errors.generic'));
        if (message) toast.error(message);
      },
    },
  });

  const remove = useDeleteCategoryHttpControllerRemove({
    mutation: {
      onSuccess: async () => {
        toast.success(t('categories.deleted'));
        await invalidate();
      },
      onError: async (error) => {
        const mapped = mapApiError(error);
        if (mapped.kind === 'outcome' && mapped.status === 'rejected_category_in_use') {
          toast.error(t('categories.errors.inUse', { count: Number(mapped.dressCount ?? 0) }));
        } else if (mapped.kind === 'fault' && mapped.code === 'GENERIC.FORBIDDEN') {
          toast.error(t('categories.errors.ownerOnly'));
        } else {
          toast.error(t('categories.errors.generic'));
        }
        await invalidate();
      },
    },
  });

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim()) create.mutate({ data: { name: draft.trim() } });
  }

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (renameTarget && renameDraft.trim()) {
      rename.mutate({ id: renameTarget.id, data: { name: renameDraft.trim() } });
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-base font-semibold">{t('categories.title')}</h2>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('categories.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center gap-2 text-sm">
              {renameTarget?.id === category.id ? (
                <form className="flex items-center gap-2" onSubmit={submitRename}>
                  <Input
                    autoFocus
                    value={renameDraft}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    aria-label={t('categories.renameLabel', { name: category.name })}
                    className="h-8 w-48"
                  />
                  <Button type="submit" size="sm" disabled={rename.isPending}>
                    {t('categories.renameSave')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRenameTarget(null)}
                  >
                    {t('categories.renameCancel')}
                  </Button>
                </form>
              ) : (
                <>
                  <span className="font-medium">{category.name}</span>
                  <span className="text-muted-foreground">
                    {t('categories.dressCount', { count: category.dressCount })}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRenameTarget(category);
                      setRenameDraft(category.name);
                    }}
                  >
                    {t('categories.rename')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setDeleteTarget(category)}
                  >
                    {t('categories.delete')}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="flex items-center gap-2" onSubmit={submitCreate}>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('categories.createPlaceholder')}
          aria-label={t('categories.createPlaceholder')}
          className="w-56"
        />
        <Button type="submit" variant="secondary" disabled={create.isPending || !draft.trim()}>
          {t('categories.create')}
        </Button>
      </form>
      {createError ? (
        <p role="alert" className="text-sm text-destructive">
          {createError}
        </p>
      ) : null}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('categories.deleteConfirm.title', { name: deleteTarget?.name ?? '' })}
        description={t('categories.deleteConfirm.description')}
        confirmLabel={t('categories.delete')}
        destructive
        onConfirm={() => {
          if (deleteTarget) remove.mutate({ id: deleteTarget.id });
          setDeleteTarget(null);
        }}
      />
    </section>
  );
}
