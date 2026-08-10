import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Verb for the action itself — never "OK": staff should read what they are about to do. */
  confirmLabel: string;
  /** Destructive actions here are irreversible (cancel a booking, retire a dress). */
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * The app's confirmation for an irreversible action, replacing `window.confirm`.
 *
 * The native dialog was wrong here for reasons that all bite on the shop's tablet: its buttons
 * follow the OS language rather than the app's Vietnamese, it blocks the JS thread, and inside an
 * installed PWA it renders as a browser chrome popup that reads as a malfunction. This one is
 * focus-trapped by Radix, labels the action with its verb, and colours a destructive confirm.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* "Quay lại", never "Hủy": on the rentals list the confirmed action is ITSELF a cancel,
              and two buttons reading Huỷ / Hủy next to each other is a coin toss. */}
          <AlertDialogCancel>{t('actions.back')}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
