import { useQueryClient } from '@tanstack/react-query';

import type {
  CancelRentalController,
  CancelRentalResult,
} from '@/components/rentals/cancel-rental-dialog';

import { mapApiError } from './errors';
import { useMeHttpControllerMe } from './generated/identity/identity';
import {
  getListPaymentsHttpControllerListQueryKey,
  useListPaymentsHttpControllerList,
} from './generated/payments/payments';
import {
  getGetRentalHttpControllerGetQueryKey,
  getGetTodayBoardHttpControllerGetQueryKey,
  getListRentalsHttpControllerListQueryKey,
  useCancelRentalHttpControllerCancel,
} from './generated/rentals/rentals';

/**
 * The data side of the ONE cancel dialog (rentals/cancel-with-refund): the rental's ledger, who is
 * asking, and the cancel itself with its outcomes mapped to plain data
 * (`components/rentals/cancel-rental-dialog.tsx` renders them). Lives in the api ring because the
 * three sites that cancel (today board, rentals list, rental detail) are three features, and the
 * kernel may not import `@/api`.
 *
 * `rentalId` null = the dialog is closed (no ledger request).
 */
export function useCancelRental(rentalId: string | null): CancelRentalController {
  const queryClient = useQueryClient();
  const payments = useListPaymentsHttpControllerList(rentalId ?? '', {
    query: { enabled: rentalId !== null },
  });
  const { data: me } = useMeHttpControllerMe();
  // The dialog renders every rejection in place; an empty onError overrides the app-wide mutation
  // toast (app/providers.tsx) so a rejection is not ALSO announced as a generic failure.
  const cancel = useCancelRentalHttpControllerCancel({ mutation: { onError: () => undefined } });

  async function refreshEverything(id: string): Promise<void> {
    // Board + list parameterless keys, the detail, and the ledger — a cancel can move money.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListRentalsHttpControllerListQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetTodayBoardHttpControllerGetQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetRentalHttpControllerGetQueryKey(id) }),
      queryClient.invalidateQueries({ queryKey: getListPaymentsHttpControllerListQueryKey(id) }),
    ]);
  }

  const ledger: CancelRentalController['ledger'] =
    payments.isPending || rentalId === null
      ? { state: 'loading' }
      : payments.isError
        ? { state: 'error', retry: () => void payments.refetch() }
        : {
            state: 'ready',
            collectedDeposit: payments.data.summary.deposit,
            collectedRentalFee: payments.data.summary.rentalFee,
          };

  return {
    ledger,
    isOwner: me?.role === 'owner',
    pending: cancel.isPending,
    submit: async (request): Promise<CancelRentalResult> => {
      if (rentalId === null) return { kind: 'notFound' };
      try {
        await cancel.mutateAsync({ id: rentalId, data: request });
        await refreshEverything(rentalId);
        return { kind: 'ok' };
      } catch (error) {
        const mapped = mapApiError(error);
        if (mapped.kind !== 'outcome') return { kind: 'fault' };
        switch (mapped.status) {
          case 'rejected_cancel_basis_changed':
            await queryClient.invalidateQueries({
              queryKey: getListPaymentsHttpControllerListQueryKey(rentalId),
            });
            return { kind: 'basisChanged' };
          case 'rejected_refund_exceeds_collected':
            return {
              kind: 'exceeds',
              field: mapped.refundKind === 'deposit' ? 'deposit' : 'rentalFee',
              collected: Number(mapped.collected ?? 0),
            };
          case 'rejected_retention_note_required':
            return { kind: 'noteRequired' };
          case 'forbidden':
            return { kind: 'forbidden' };
        }
        // Stale-state rejections: another device moved this rental on — refresh every view.
        await refreshEverything(rentalId);
        if (mapped.status === 'rejected_cancel_not_allowed') {
          return { kind: 'notAllowed', currentStatus: String(mapped.currentStatus ?? '') };
        }
        if (mapped.status === 'rejected_cancel_has_payments') return { kind: 'hasPayments' };
        return { kind: 'notFound' };
      }
    },
  };
}
