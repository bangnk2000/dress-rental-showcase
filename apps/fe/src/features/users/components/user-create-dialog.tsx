import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
import {
  getListUsersHttpControllerListQueryKey,
  useCreateUserHttpControllerCreate,
} from '@/api/generated/identity/identity';
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

import { createUserSchema, type CreateUserValues } from '../schemas/user-form.schema';
import { UserFormMessage } from './user-form-message';

interface UserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserCreateDialog({ open, onOpenChange }: UserCreateDialogProps) {
  const { t } = useTranslation('users');
  const queryClient = useQueryClient();

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { username: '', name: '', password: '' },
  });

  const create = useCreateUserHttpControllerCreate({
    mutation: {
      onSuccess: async () => {
        toast.success(t('create.success'));
        form.reset();
        onOpenChange(false);
        await queryClient.invalidateQueries({
          queryKey: getListUsersHttpControllerListQueryKey(),
        });
      },
      onError: (error) => {
        const mapped = mapApiError(error);
        if (mapped.kind === 'outcome' && mapped.status === 'rejected_username_taken') {
          // The payload carries the NORMALIZED username the pre-check (or the race) hit.
          form.setError('username', { message: 'validation.usernameTaken' });
          return;
        }
        toast.error(t('create.error'));
      },
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    create.mutate({ data: values });
  });

  function handleOpenChange(next: boolean) {
    if (!next) form.reset();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>{t('create.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.username')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" autoCapitalize="none" {...field} />
                  </FormControl>
                  <UserFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.name')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <UserFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.password')}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <UserFormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? t('create.submitting') : t('create.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
