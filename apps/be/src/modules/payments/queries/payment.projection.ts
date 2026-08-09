import { z } from 'zod';
import { toDate } from '../../../libs/utils/date';
import {
  PaymentDto,
  PaymentSummaryDto,
} from './list-payments/list-payments.response.dto';

export const paymentRowSchema = z.object({
  id: z.string(),
  kind: z.enum(['deposit', 'deposit_refund', 'rental_fee', 'late_fee', 'damage_fee']),
  amount: z.number().int(),
  note: z.string().nullable(),
  created_at: z.union([z.number(), z.string(), z.date()]),
});

export type PaymentRow = z.infer<typeof paymentRowSchema>;

/**
 * Per-kind totals of a rental's movements (FR-PAY-02 §4). Summed here rather than in SQL: the
 * rows are already loaded for the list, and a pure function is the piece worth unit-testing.
 * A kind with no row totals 0 — the FE tells "nothing collected" from that.
 */
export function toPaymentSummaryDto(rows: readonly PaymentRow[]): PaymentSummaryDto {
  const total = (kind: PaymentRow['kind']): number =>
    rows.reduce((sum, row) => (row.kind === kind ? sum + row.amount : sum), 0);

  return Object.assign(new PaymentSummaryDto(), {
    deposit: total('deposit'),
    rentalFee: total('rental_fee'),
    depositRefund: total('deposit_refund'),
    lateFee: total('late_fee'),
    damageFee: total('damage_fee'),
  });
}

export function toPaymentDto(row: PaymentRow): PaymentDto {
  return Object.assign(new PaymentDto(), {
    id: row.id,
    kind: row.kind,
    amount: row.amount,
    note: row.note,
    createdAt: toDate(row.created_at).toISOString(),
  });
}
