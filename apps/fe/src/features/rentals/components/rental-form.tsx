import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { formatVnd } from '@/lib/format';

import {
  rentalFormDefaults,
  rentalFormSchema,
  type RentalFormValues,
} from '../schemas/rental-form.schema';
import { parseCollectAmount } from '../lib/parse-collect-amount';
import {
  BookingPaymentFields,
  type BookingPaymentValues,
  type PaymentErrors,
} from './booking-payment-fields';
import { DressPicker, type BlockedDresses, type PickerPeriod, type SelectedDress } from './dress-picker';
import { RentalFormMessage } from './rental-form-message';

/** What the form hands the route once every client-side rule passed. */
export interface RentalFormSubmission {
  customerName: string;
  customerPhone: string;
  startDate: string;
  endDate: string;
  /** Trimmed; '' = no notes. */
  notes: string;
  /** VND (FR-RENT-11); 0 = none. */
  discountAmount: number;
  /** The picked dresses; `rentalPrice` is the price on screen for each. */
  items: SelectedDress[];
  /** FR-RENT-14, create only: money handed over at booking; absent = not collected. */
  collect?: { deposit?: number; rentalFee?: number };
}

interface RentalFormProps {
  /** create = a new booking (born-delivered hint, create copy); edit = FR-RENT-13. */
  mode: 'create' | 'edit';
  defaultValues?: RentalFormValues;
  defaultSelected?: SelectedDress[];
  /** The rental being edited — its own bookings are not conflicts in the picker. */
  ignoreRentalId?: string;
  submitLabel: string;
  /**
   * Sends the booking. Resolve on success (the route owns toasts, invalidation and navigation);
   * reject with the API error to have the form render the dress rejections in place. A route
   * that handles an outcome itself (e.g. "rental no longer open") simply does not rethrow it.
   */
  onSubmit: (submission: RentalFormSubmission) => Promise<void>;
  onCancel: () => void;
}

/**
 * The `dressIds` an outcome payload carries (ADR 0001 §3). Typed as `unknown` at the seam, so the
 * form checks the shape rather than trusting it.
 */
function readDressIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}

/**
 * Identity of a booking ATTEMPT: the dates and the set of dresses, which is exactly what every
 * rejection outcome answers about. Two attempts with the same key deserve the same verdict; a
 * verdict for any other key belongs to a request the staff has already moved past.
 */
function bookingKey(startDate: string, endDate: string, dressIds: string[]): string {
  return [startDate, endDate, [...dressIds].sort().join(',')].join('|');
}

/** The SHOP's calendar day — the same rule the API applies to decide born-delivered. */
function shopTodayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** The typed discount as VND (FR-RENT-11); blank or not-yet-digits = none. */
export function parseDiscount(raw: string): number {
  const trimmed = raw.trim();
  const value = Number(trimmed);
  return trimmed !== '' && Number.isInteger(value) && value > 0 ? value : 0;
}

/**
 * ONE form for a rental's content — the new-rental screen and the owner's edit screen
 * (FR-RENT-13) render it with different defaults and a different submit. It owns everything
 * that is about the FORM: the schema, the picked dresses, the discount bound, and the designed
 * state of each dress rejection (ADR 0001 §4): the form stays filled and says WHICH dresses are
 * the problem.
 */
export function RentalForm({
  mode,
  defaultValues = rentalFormDefaults,
  defaultSelected = [],
  ignoreRentalId,
  submitLabel,
  onSubmit,
  onCancel,
}: RentalFormProps) {
  const { t } = useTranslation('rentals');
  const { t: tCommon } = useTranslation('common'); // shared verbs only

  const form = useForm<RentalFormValues>({
    resolver: zodResolver(rentalFormSchema),
    defaultValues,
  });
  const [selected, setSelected] = useState<SelectedDress[]>(defaultSelected);
  const [submitting, setSubmitting] = useState(false);
  /** i18n key — set on empty selection at submit, or from a rejection outcome. */
  const [formError, setFormError] = useState<string | null>(null);
  /** Which dresses the last rejection named (ADR 0001 payload), so the picker can point at them. */
  const [blocked, setBlocked] = useState<BlockedDresses | null>(null);

  // The dates the picker checks against. Only a sensible range is worth asking the server about.
  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');
  const period: PickerPeriod | null =
    startDate && endDate && startDate <= endDate ? { startDate, endDate } : null;
  // FR-RENT-11: the discount is bounded by the subtotal of the CURRENT selection, which lives
  // outside the schema — so the bound is checked here, at submit, and shown live by the picker.
  const discount = parseDiscount(form.watch('discountAmount'));
  const subtotal = selected.reduce((sum, dress) => sum + dress.rentalPrice, 0);

  // FR-RENT-14 (create only): the money block. Both amounts follow the selection and discount
  // (§3 "pre-fill tính lại") until staff types in that field — then their number stands.
  const expectedFee = Math.max(0, subtotal - discount);
  const standardDeposit = selected.reduce((sum, dress) => sum + (dress.depositAmount ?? 0), 0);
  const [payment, setPayment] = useState<BookingPaymentValues>({
    rentalFee: '',
    depositPaid: false,
    deposit: '',
  });
  const touched = useRef({ rentalFee: false, deposit: false });
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors>({});
  useEffect(() => {
    setPayment((current) => ({
      ...current,
      rentalFee: touched.current.rentalFee
        ? current.rentalFee
        : expectedFee > 0
          ? String(expectedFee)
          : '',
      deposit: touched.current.deposit
        ? current.deposit
        : standardDeposit > 0
          ? String(standardDeposit)
          : '',
    }));
  }, [expectedFee, standardDeposit]);
  const bornOut = mode === 'create' && !!startDate && startDate <= shopTodayIso();

  /**
   * The current selection, readable after an awaited submit — which captured the `selected` of
   * the render that fired it, not the one on screen when the answer arrives.
   */
  const selectedRef = useRef<SelectedDress[]>(defaultSelected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // A rejection belongs to the dates it was answered for. Changing them makes it stale — both the
  // per-dress marking AND the message, or the form keeps telling staff that the booking they just
  // corrected is invalid. The per-dress availability check below answers for the new range.
  useEffect(() => {
    setBlocked(null);
    setFormError(null);
  }, [startDate, endDate]);

  const genericErrorKey = mode === 'create' ? 'form.error' : 'edit.error';

  const submit = form.handleSubmit(async (values) => {
    if (selected.length === 0) {
      setFormError('form.errors.noDresses');
      return;
    }
    const discountAmount = parseDiscount(values.discountAmount);
    if (discountAmount > subtotal) {
      form.setError('discountAmount', { message: 'form.errors.discountTooLarge' });
      return;
    }
    setFormError(null);
    const answered = bookingKey(
      values.startDate,
      values.endDate,
      selected.map((dress) => dress.id),
    );
    const collectedFee = parseCollectAmount(payment.rentalFee);
    const collectedDeposit = payment.depositPaid ? parseCollectAmount(payment.deposit) : null;
    if (mode === 'create') {
      // A typo must never turn money that changed hands into "not collected" (Codex PR #39 C1):
      // a non-blank fee must be an amount, and a ticked deposit must carry one.
      const errors: PaymentErrors = {
        ...(payment.rentalFee.trim() !== '' && collectedFee === null
          ? { rentalFee: 'form.payment.errors.invalidAmount' }
          : {}),
        ...(payment.depositPaid && collectedDeposit === null
          ? { deposit: 'form.payment.errors.depositRequired' }
          : {}),
      };
      setPaymentErrors(errors);
      if (errors.rentalFee || errors.deposit) return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        startDate: values.startDate,
        endDate: values.endDate,
        notes: values.notes,
        discountAmount,
        items: selected,
        ...(mode === 'create' && (collectedFee !== null || collectedDeposit !== null)
          ? {
              collect: {
                ...(collectedFee !== null ? { rentalFee: collectedFee } : {}),
                ...(collectedDeposit !== null ? { deposit: collectedDeposit } : {}),
              },
            }
          : {}),
      });
    } catch (error) {
      // The answer must belong to the booking still on screen. Staff who edits the dates or the
      // selection while the request is in flight would otherwise get rows marked unavailable for
      // a range that was never submitted.
      const onScreen = bookingKey(
        form.getValues('startDate'),
        form.getValues('endDate'),
        selectedRef.current.map((dress) => dress.id),
      );
      if (answered !== onScreen) {
        // Still say the booking did not go through: nothing was saved either way.
        toast.error(t(genericErrorKey));
        return;
      }

      const mapped = mapApiError(error);
      const dressIds = mapped.kind === 'outcome' ? readDressIds(mapped.dressIds) : [];
      switch (mapped.kind === 'outcome' ? mapped.status : null) {
        case 'rejected_dress_unavailable':
          setFormError('form.errors.dressUnavailable');
          setBlocked({ dressIds, reason: 'unavailable' });
          return;
        case 'rejected_dress_retired':
          setFormError('form.errors.dressRetired');
          setBlocked({ dressIds, reason: 'retired' });
          return;
        case 'rejected_dress_not_found':
          setFormError('form.errors.dressNotFound');
          setBlocked({ dressIds, reason: 'notFound' });
          return;
        default:
          toast.error(t(genericErrorKey));
      }
    } finally {
      setSubmitting(false);
    }
  });

  const translate = t as unknown as (key: string) => string;

  return (
    <Form {...form}>
      <form onSubmit={(event) => void submit(event)} className="grid max-w-2xl gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="customerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.fields.customerName')}</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <RentalFormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="customerPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.fields.customerPhone')}</FormLabel>
                <FormControl>
                  <Input inputMode="tel" autoComplete="off" {...field} />
                </FormControl>
                <RentalFormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.fields.startDate')}</FormLabel>
                <FormControl>
                  <Input type="date" autoComplete="off" {...field} />
                </FormControl>
                {/* FR-RENT-10: same-day (or backdated) rentals are born DELIVERED — say so
                    before submit, so the status on the list is no surprise. An EDIT never moves
                    the status (FR-RENT-13 §6.Q3), so the hint is create-only. */}
                {mode === 'create' && field.value && field.value <= shopTodayIso() ? (
                  <p className="text-sm text-muted-foreground">{t('form.startsToday')}</p>
                ) : null}
                <RentalFormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.fields.endDate')}</FormLabel>
                <FormControl>
                  <Input type="date" autoComplete="off" {...field} />
                </FormControl>
                <RentalFormMessage />
              </FormItem>
            )}
          />
        </div>
        <p className="text-sm text-muted-foreground">{t('form.bufferHint')}</p>
        <DressPicker
          selected={selected}
          onAdd={(dress) => {
            setSelected((current) => [...current, dress]);
            setFormError(null);
            setBlocked(null);
          }}
          onRemove={(dressId) => {
            setSelected((current) => current.filter((dress) => dress.id !== dressId));
            // Dropping a dress can be exactly the fix the rejection asked for, so the message
            // goes with the marking rather than outliving the problem it described.
            setBlocked(null);
            setFormError(null);
          }}
          error={formError === 'form.errors.noDresses' ? formError : null}
          period={period}
          blocked={blocked}
          discount={discount}
          {...(ignoreRentalId ? { ignoreRentalId } : {})}
        />
        <FormField
          control={form.control}
          name="discountAmount"
          render={({ field }) => {
            const amount = parseDiscount(field.value);
            return (
              <FormItem>
                <FormLabel>{t('form.fields.discountAmount')}</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" autoComplete="off" {...field} />
                </FormControl>
                {/* Money the user typed is read back grouped (screen rules); otherwise the
                    field says what it is for. */}
                <FormDescription className="tabular-nums">
                  {amount > 0 ? formatVnd(amount) : t('form.discountHint')}
                </FormDescription>
                <RentalFormMessage />
              </FormItem>
            );
          }}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.fields.notes')}</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <RentalFormMessage />
            </FormItem>
          )}
        />
        {mode === 'create' ? (
          <BookingPaymentFields
            values={payment}
            onChange={(next) => {
              if (next.rentalFee !== payment.rentalFee) touched.current.rentalFee = true;
              if (next.deposit !== payment.deposit) touched.current.deposit = true;
              setPayment(next);
              setPaymentErrors({});
            }}
            errors={paymentErrors}
            expectedFee={expectedFee}
            standardDeposit={standardDeposit}
            bornOut={bornOut}
          />
        ) : null}
        {/* Every rejection outcome renders form-level here; the picker owns only noDresses. */}
        {formError && formError !== 'form.errors.noDresses' ? (
          <p role="alert" className="text-sm text-destructive">
            {translate(formError)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {tCommon('actions.cancel')}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
