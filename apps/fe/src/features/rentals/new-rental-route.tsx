import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import {
  getGetTodayBoardHttpControllerGetQueryKey,
  getListRentalsHttpControllerListQueryKey,
  useCreateRentalHttpControllerCreate,
} from '@/api/generated/rentals/rentals';
import type { CreateRentalRequestDto } from '@/api/generated/model';
import { PageHeader } from '@/components/layout/page-header';

import { RentalForm, type RentalFormSubmission } from './components/rental-form';

/** The SHOP's calendar day — the same rule the API applies to decide born-delivered. */
function shopTodayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Form submission → request body; blank notes and a zero discount are omitted. */
function toCreateRentalRequest(submission: RentalFormSubmission): CreateRentalRequestDto {
  return {
    customerName: submission.customerName,
    customerPhone: submission.customerPhone,
    startDate: submission.startDate,
    endDate: submission.endDate,
    ...(submission.notes ? { notes: submission.notes } : {}),
    ...(submission.discountAmount > 0 ? { discountAmount: submission.discountAmount } : {}),
    // Price omitted on purpose: the BE defaults to each dress's standard price.
    items: submission.items.map((dress) => ({ dressId: dress.id })),
  };
}

export function NewRentalRoute() {
  const { t } = useTranslation('rentals');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // The form renders every rejection in place (ADR 0001 §4); an empty onError here overrides the
  // global mutation toast so a dress rejection is not ALSO announced as a generic failure.
  const createRental = useCreateRentalHttpControllerCreate({
    mutation: { onError: () => undefined },
  });

  async function onSubmit(submission: RentalFormSubmission): Promise<void> {
    await createRental.mutateAsync({ data: toCreateRentalRequest(submission) });
    // The cached list/board may still be FRESH (staleTime 60s) — without
    // this, the post-create landing shows a list missing the new rental.
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListRentalsHttpControllerListQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetTodayBoardHttpControllerGetQueryKey(),
      }),
    ]);
    toast.success(
      submission.startDate <= shopTodayIso() ? t('form.successDelivered') : t('form.success'),
    );
    void navigate('/rentals');
  }

  return (
    <>
      <PageHeader title={t('newTitle')} />
      <RentalForm
        mode="create"
        submitLabel={t('form.submit')}
        onSubmit={onSubmit}
        onCancel={() => void navigate('/rentals')}
      />
    </>
  );
}
