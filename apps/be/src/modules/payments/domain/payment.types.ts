import { Money } from '../../../libs/ddd/money.value-object';

/**
 * The kinds this context RECORDS as money coming in (FR-PAY-02 R1). Every other kind is written
 * by the rentals context and deliberately not creatable here: `late_fee` / `damage_fee` by the
 * return flow, `rental_fee_refund` by the cancel flow, and `deposit_refund` by BOTH — the deposit
 * goes back either when the dress comes back or when a prepaid booking is cancelled
 * (R1 amended 2026-11-07, docs/design/rentals/cancel-with-refund.md §6).
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
