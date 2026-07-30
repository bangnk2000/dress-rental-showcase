export const PAYMENT_RECORDER = Symbol('PAYMENT_RECORDER');

/** The money movements a return settles, in the payments context's own kinds. */
export type SettlementPaymentKind = 'deposit_refund' | 'late_fee' | 'damage_fee';

export interface SettlementPayment {
  kind: SettlementPaymentKind;
  /** VND, integer, > 0 — zero-amount movements are not recorded. */
  amount: number;
  note: string | null;
}

/**
 * Write-only door into the payments-owned table. The payments context has no
 * domain code yet (schema only) — the adapter writes its rows directly, the
 * same boundary trick DressLookupAdapter uses for catalog reads.
 */
export interface PaymentRecorderPort {
  recordSettlement(rentalId: string, payments: SettlementPayment[]): Promise<void>;
}
