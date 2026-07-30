import { z } from 'zod';
import { toDate } from '../../../libs/utils/date';
import { PaymentDto } from './list-payments/list-payments.response.dto';

export const paymentRowSchema = z.object({
  id: z.string(),
  kind: z.enum(['deposit', 'deposit_refund', 'rental_fee', 'late_fee', 'damage_fee']),
  amount: z.number().int(),
  note: z.string().nullable(),
  created_at: z.union([z.number(), z.string(), z.date()]),
});

export type PaymentRow = z.infer<typeof paymentRowSchema>;

export function toPaymentDto(row: PaymentRow): PaymentDto {
  return Object.assign(new PaymentDto(), {
    id: row.id,
    kind: row.kind,
    amount: row.amount,
    note: row.note,
    createdAt: toDate(row.created_at).toISOString(),
  });
}
