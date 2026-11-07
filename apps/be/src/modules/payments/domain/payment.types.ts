import { Money } from '../../../libs/ddd/money.value-object';

/**
 * The kinds this context RECORDS as money coming in (FR-PAY-02 R1). The three settlement kinds
 * (`deposit_refund`, `late_fee`, `damage_fee`) are written by the rentals return flow and are
 * deliberately not creatable here — one movement has exactly one place that produces it.
 */
export type CollectionKind = 'deposit' | 'rental_fee';

export const COLLECTION_KINDS: readonly CollectionKind[] = ['deposit', 'rental_fee'];

/**
 * Every kind the `payments` table may hold, collected + settlement. `rental_fee_refund` is written
 * only by the rentals cancel flow (rentals/cancel-with-refund).
 */
export type PaymentKind =
  | CollectionKind
  | 'deposit_refund'
  | 'rental_fee_refund'
  | 'late_fee'
  | 'damage_fee';

export interface PaymentProps {
  rentalId: string;
  kind: PaymentKind;
  amount: Money;
  note: string | null;
}

export interface CreatePaymentProps {
  rentalId: string;
  kind: CollectionKind;
  amount: Money;
  note: string | null;
}
