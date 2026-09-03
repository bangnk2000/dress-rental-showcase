import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useResetPasswordHttpControllerResetPassword } from '@/api/generated/identity/identity';
import type { UserDto } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { resetPasswordSchema, type ResetPasswordValues } from '../schemas/user-form.schema';
import { UserFormMessage } from './user-form-message';

interface ResetPasswordDialogProps {
  user: UserDto | null;
  onOpenChange: (open: boolean) => void;
}

/** Owner sets the new password directly — the shop has no email to send a link to. */
export function ResetPasswordDialog({ user, onOpenChange }: ResetPasswordDialogProps) {
  const { t } = useTranslation('users');

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '' },
  });

  const reset = useResetPasswordHttpControllerResetPassword({
    mutation: {
      onSuccess: () => {
        toast.success(t('resetPassword.success', { username: user?.username ?? '' }));
        form.reset();
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('resetPassword.error'));
      },
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!user) return;
    reset.mutate({ id: user.id, data: values });
  });

  function handleOpenChange(next: boolean) {
    if (!next) form.reset();
    onOpenChange(next);
  }

  return (
    <Dialog open={user !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('resetPassword.title', { username: user?.username ?? '' })}</DialogTitle>
          <DialogDescription>{t('resetPassword.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.newPassword')}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <UserFormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={reset.isPending}>
                {reset.isPending ? t('resetPassword.submitting') : t('resetPassword.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
