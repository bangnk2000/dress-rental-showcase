import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
import {
  getListUsersHttpControllerListQueryKey,
  useDeactivateUserHttpControllerDeactivate,
  useListUsersHttpControllerListSuspense,
  useMeHttpControllerMeSuspense,
  useReactivateUserHttpControllerReactivate,
} from '@/api/generated/identity/identity';
import type { UserDto } from '@/api/generated/model';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { ResetPasswordDialog } from './components/reset-password-dialog';
import { UserCreateDialog } from './components/user-create-dialog';

/**
 * Owner-only account management (identity/manage-users). The route guards itself on me.role —
 * display only; the BE policy (user:manage, fail-closed) is the actual rule. The me query is
 * already in the cache (the session provider hydrated it), so the guard costs no request.
 */
export function UsersRoute() {
  const { t } = useTranslation('users');
  const queryClient = useQueryClient();
  const { data: me } = useMeHttpControllerMeSuspense();
  const { data: users } = useListUsersHttpControllerListSuspense();

  const [createOpen, setCreateOpen] = useState(false);
  const [lockTarget, setLockTarget] = useState<UserDto | null>(null);
  const [resetTarget, setResetTarget] = useState<UserDto | null>(null);

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: getListUsersHttpControllerListQueryKey() });

  const onActionError = (error: unknown) => {
    const mapped = mapApiError(error);
    // already-inactive / already-active: another device beat us — say so and refresh the truth.
    toast.error(
      mapped.kind === 'outcome' ? t('actions.staleState') : t('actions.error'),
    );
    void invalidateList();
  };

  const deactivate = useDeactivateUserHttpControllerDeactivate({
    mutation: {
      onSuccess: async () => {
        toast.success(t('actions.locked'));
        await invalidateList();
      },
      onError: onActionError,
    },
  });

  const reactivate = useReactivateUserHttpControllerReactivate({
    mutation: {
      onSuccess: async () => {
        toast.success(t('actions.unlocked'));
        await invalidateList();
      },
      onError: onActionError,
    },
  });

  if (me.role !== 'owner') {
    return <Navigate to="/" replace />;
  }

  const pending = deactivate.isPending || reactivate.isPending;
  const pendingRowId = deactivate.isPending
    ? deactivate.variables?.id
    : reactivate.isPending
      ? reactivate.variables?.id
      : undefined;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <Button onClick={() => setCreateOpen(true)}>{t('create.open')}</Button>
      </div>

      <Table stacked>
        <TableHeader>
          <TableRow>
            <TableHead>{t('columns.username')}</TableHead>
            <TableHead>{t('columns.name')}</TableHead>
            <TableHead>{t('columns.role')}</TableHead>
            <TableHead>{t('columns.status')}</TableHead>
            <TableHead className="text-right">{t('columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.data.map((user) => {
            const isSelf = user.id === me.id;
            const rowPending = pendingRowId === user.id;
            return (
              <TableRow key={user.id}>
                <TableCell stack="title" className="font-medium">
                  {user.username}
                </TableCell>
                <TableCell stack="full">{user.name}</TableCell>
                <TableCell label={t('columns.role')}>
                  {t(user.role === 'owner' ? 'roles.owner' : 'roles.staff')}
                </TableCell>
                <TableCell label={t('columns.status')}>
                  <Badge variant={user.active ? 'secondary' : 'destructive'}>
                    {user.active ? t('status.active') : t('status.locked')}
                  </Badge>
                </TableCell>
                <TableCell stack="actions" className="space-x-2 text-right max-md:space-x-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setResetTarget(user)}
                  >
                    {t('actions.resetPassword')}
                  </Button>
                  {/* Your own row has no lock button: the BE refuses it anyway
                      (rejected_cannot_deactivate_self) — don't offer a dead end. */}
                  {isSelf ? null : user.active ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setLockTarget(user)}
                    >
                      {rowPending ? t('actions.working') : t('actions.lock')}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => reactivate.mutate({ id: user.id })}
                    >
                      {rowPending ? t('actions.working') : t('actions.unlock')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <UserCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ResetPasswordDialog
        user={resetTarget}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
      />
      <ConfirmDialog
        open={lockTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLockTarget(null);
        }}
        title={t('lockConfirm.title', { username: lockTarget?.username ?? '' })}
        description={t('lockConfirm.description')}
        confirmLabel={t('actions.lock')}
        destructive
        onConfirm={() => {
          if (lockTarget) deactivate.mutate({ id: lockTarget.id });
          setLockTarget(null);
        }}
      />
    </section>
  );
}
