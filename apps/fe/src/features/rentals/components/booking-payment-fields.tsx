import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatVnd } from '@/lib/format';

import { parseCollectAmount } from '../lib/parse-collect-amount';

export interface BookingPaymentValues {
  /** '' = not collected (§6.Q1). */
  rentalFee: string;
  depositPaid: boolean;
  deposit: string;
}

/** i18n keys (rentals namespace) shown under each field; set at submit by the form. */
export interface PaymentErrors {
  rentalFee?: string;
  deposit?: string;
}

interface BookingPaymentFieldsProps {
  values: BookingPaymentValues;
  errors: PaymentErrors;
  onChange: (next: BookingPaymentValues) => void;
  /** Σ agreed price − discount: what the pre-fill of the fee is based on. */
  expectedFee: number;
  /** Σ catalog standard deposit of the picked dresses. */
  standardDeposit: number;
  /** FR-RENT-10b: the rental will be born `out` — no pickup screen will ever ask for a deposit. */
  bornOut: boolean;
}

/**
 * FR-RENT-14 (docs/design/rentals/deposit-at-pickup.md §3): the money handed over at booking,
 * written to the ledger with the rental. Fee optional and pre-filled (§6.Q1); deposit behind an
 * UNticked checkbox (§6.Q2) with an editable amount (§6.Q4); a born-out booking without a deposit
 * only warns (§6.Q5). Every amount reads back grouped (screen rules).
 */
export function BookingPaymentFields({
  values,
  errors,
  onChange,
  expectedFee,
  standardDeposit,
  bornOut,
}: BookingPaymentFieldsProps) {
  const { t } = useTranslation('rentals');
  const translate = t as unknown as (key: string) => string;
  const errorFor = (key: string | undefined) =>
    key ? (
      <p role="alert" className="text-sm text-destructive">
        {translate(key)}
      </p>
    ) : null;
  const fee = parseCollectAmount(values.rentalFee);
  const deposit = parseCollectAmount(values.deposit);

  return (
    <fieldset className="grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{t('form.payment.title')}</legend>
      <div className="grid gap-1.5">
        <Label htmlFor="booking-rental-fee">{t('form.payment.rentalFee')}</Label>
        <Input
          id="booking-rental-fee"
          inputMode="numeric"
          autoComplete="off"
          value={values.rentalFee}
          onChange={(event) => onChange({ ...values, rentalFee: event.target.value })}
        />
        <p className="text-sm text-muted-foreground tabular-nums">
          {fee !== null
            ? formatVnd(fee)
            : t('form.payment.rentalFeeHint', { amount: formatVnd(expectedFee) })}
        </p>
        {errorFor(errors.rentalFee)}
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-5 shrink-0"
          checked={values.depositPaid}
          onChange={(event) => onChange({ ...values, depositPaid: event.target.checked })}
        />
        {t('form.payment.depositPaid')}
      </label>
      {values.depositPaid ? (
        <div className="grid gap-1.5">
          <Label htmlFor="booking-deposit">{t('form.payment.deposit')}</Label>
          <Input
            id="booking-deposit"
            inputMode="numeric"
            autoComplete="off"
            value={values.deposit}
            onChange={(event) => onChange({ ...values, deposit: event.target.value })}
          />
          <p className="text-sm text-muted-foreground tabular-nums">
            {deposit !== null
              ? formatVnd(deposit)
              : t('form.payment.depositHint', { amount: formatVnd(standardDeposit) })}
          </p>
          {errorFor(errors.deposit)}
        </div>
      ) : null}
      {bornOut && !(values.depositPaid && deposit !== null) ? (
        <p role="status" className="rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {t('form.payment.bornOutNoDeposit')}
        </p>
      ) : null}
    </fieldset>
  );
}
