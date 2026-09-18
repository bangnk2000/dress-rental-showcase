import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
import { useMeHttpControllerMeSuspense } from '@/api/generated/identity/identity';
import {
  getGetRentalHttpControllerGetQueryKey,
  getGetTodayBoardHttpControllerGetQueryKey,
  getListRentalsHttpControllerListQueryKey,
  useGetRentalHttpControllerGetSuspense,
  useUpdateRentalHttpControllerUpdate,
} from '@/api/generated/rentals/rentals';
import type { RentalDetailDto, UpdateRentalRequestDto } from '@/api/generated/model';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';

import { RentalForm, type RentalFormSubmission } from './components/rental-form';
import type { SelectedDress } from './components/dress-picker';
import type { RentalFormValues } from './schemas/rental-form.schema';

/** Only an OPEN rental can be edited (FR-RENT-13 R1). */
function isOpenRental(status: RentalDetailDto['status']): boolean {
  return status === 'booked' || status === 'out';
}

/** The rental as stored → the form's values; a zero discount reads as a blank field. */
function toFormValues(rental: RentalDetailDto): RentalFormValues {
  return {
    customerName: rental.customerName,
    customerPhone: rental.customerPhone,
    startDate: rental.startDate,
    endDate: rental.endDate,
    notes: rental.notes ?? '',
    discountAmount: rental.discountAmount > 0 ? String(rental.discountAmount) : '',
  };
}

/**
 * The rental's dresses as picker rows. `rentalPrice` is the AGREED price, not the catalog's:
 * the number on screen is the number that gets saved back.
 */
function toSelectedDresses(rental: RentalDetailDto): SelectedDress[] {
  return rental.dresses.map((dress) => ({
    id: dress.dressId,
    code: dress.code,
    name: dress.name,
    rentalPrice: dress.agreedPrice,
  }));
}

/**
 * Form submission → PATCH body. The form is the full picture, so every field is sent: blank notes
 * become null (clear), and every dress carries the price shown for it — a kept dress its agreed
 * price, an added one the catalog price it was picked at. What you see is what is saved.
 */
function toUpdateRentalRequest(submission: RentalFormSubmission): UpdateRentalRequestDto {
  return {
    customerName: submission.customerName,
    customerPhone: submission.customerPhone,
    startDate: submission.startDate,
    endDate: submission.endDate,
    notes: submission.notes ? submission.notes : null,
    discountAmount: submission.discountAmount,
    items: submission.items.map((dress) => ({ dressId: dress.id, price: dress.rentalPrice })),
  };
}

export function EditRentalRoute() {
  const { id } = useParams<{ id: string }>();
  return id ? <EditRental rentalId={id} /> : null;
}

/**
 * FR-RENT-13: the owner rewrites an open rental. The route guards itself on me.role — display
 * only; the BE policy (rental:update, owner-only, fail-closed) is the actual rule. The me query is
 * already in the cache (the session provider hydrated it), so the guard costs no request.
 */
function EditRental({ rentalId }: { rentalId: string }) {
  const { t } = useTranslation('rentals');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMeHttpControllerMeSuspense();
  const { data: rental } = useGetRentalHttpControllerGetSuspense(rentalId);

  // Dress rejections render inside the form; the two rental-level outcomes are handled below.
  // The empty onError overrides the global mutation toast for both.
  const updateRental = useUpdateRentalHttpControllerUpdate({
    mutation: { onError: () => undefined },
  });

  async function refreshRentalQueries(): Promise<void> {
    // The list, the board (dates may have moved) and this rental's detail.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListRentalsHttpControllerListQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetTodayBoardHttpControllerGetQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetRentalHttpControllerGetQueryKey(rentalId) }),
    ]);
  }

  async function onSubmit(submission: RentalFormSubmission): Promise<void> {
    try {
      await updateRental.mutateAsync({ id: rentalId, data: toUpdateRentalRequest(submission) });
    } catch (error) {
      const mapped = mapApiError(error);
      if (mapped.kind === 'outcome' && mapped.status === 'rejected_update_not_allowed') {
        // Staff closed the rental while the owner was editing: say which state it is in and
        // go back to the (refreshed) detail — there is nothing left to edit here.
        toast.error(
          t('edit.notAllowed', {
            status: t(`status.${String(mapped.currentStatus)}`, {
              defaultValue: String(mapped.currentStatus ?? ''),
            }),
          }),
        );
        await refreshRentalQueries();
        void navigate(`/rentals/${rentalId}`);
        return;
      }
      if (mapped.kind === 'outcome' && mapped.status === 'rejected_rental_not_found') {
        toast.error(t('errors.rentalNotFound'));
        await refreshRentalQueries();
        void navigate('/rentals');
        return;
      }
      throw error; // the form renders the dress rejections and the generic failure
    }
    await refreshRentalQueries();
    toast.success(t('edit.success'));
    void navigate(`/rentals/${rentalId}`);
  }

  if (me.role !== 'owner') {
    return <Navigate to={`/rentals/${rentalId}`} replace />;
  }

  return (
    <>
      <PageHeader
        title={t('edit.title')}
        description={t('detail.title', { customer: rental.customerName })}
      />
      {isOpenRental(rental.status) ? (
        <RentalForm
          mode="edit"
          defaultValues={toFormValues(rental)}
          defaultSelected={toSelectedDresses(rental)}
          ignoreRentalId={rentalId}
          submitLabel={t('edit.submit')}
          onSubmit={onSubmit}
          onCancel={() => void navigate(`/rentals/${rentalId}`)}
        />
      ) : (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-muted-foreground">
            {t('edit.closed')}
          </p>
          <Button asChild variant="outline">
            <Link to={`/rentals/${rentalId}`}>{t('edit.backToDetail')}</Link>
          </Button>
        </div>
      )}
    </>
  );
}
