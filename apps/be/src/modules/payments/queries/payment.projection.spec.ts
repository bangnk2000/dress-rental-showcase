import { PaymentRow, toPaymentDto, toPaymentSummaryDto } from './payment.projection';

test('maps a payments row to the response shape with an ISO timestamp', () => {
  const dto = toPaymentDto({
    id: '00000000-0000-4000-8000-000000000201',
    kind: 'deposit_refund',
    amount: 2_800_000,
    note: 'Trễ 1 ngày',
    created_at: '2026-08-04T10:00:00.000Z',
  });

  expect(dto).toEqual({
    id: '00000000-0000-4000-8000-000000000201',
    kind: 'deposit_refund',
    amount: 2_800_000,
    note: 'Trễ 1 ngày',
    createdAt: '2026-08-04T10:00:00.000Z',
  });
});

test('a null note stays null (not the string "null")', () => {
  const dto = toPaymentDto({
    id: '00000000-0000-4000-8000-000000000202',
    kind: 'late_fee',
    amount: 200_000,
    note: null,
    created_at: new Date('2026-08-04T10:00:00.000Z'),
  });

  expect(dto.note).toBeNull();
  expect(dto.createdAt).toBe('2026-08-04T10:00:00.000Z');
});

function row(kind: PaymentRow['kind'], amount: number): PaymentRow {
  return {
    id: `00000000-0000-4000-8000-00000000030${amount % 10}`,
    kind,
    amount,
    note: null,
    created_at: '2026-08-10T03:00:00.000Z',
  };
}

test('the summary totals each kind separately; a kind with no row is 0, never absent', () => {
  const summary = toPaymentSummaryDto([
    row('deposit', 3_000_000),
    row('rental_fee', 1_500_000),
    row('late_fee', 200_000),
    row('deposit_refund', 2_800_000),
  ]);

  expect(summary).toEqual({
    deposit: 3_000_000,
    rentalFee: 1_500_000,
    depositRefund: 2_800_000,
    lateFee: 200_000,
    damageFee: 0,
  });
});

test('an empty ledger totals zero everywhere — that is how a screen tells "nothing collected"', () => {
  expect(toPaymentSummaryDto([])).toEqual({
    deposit: 0,
    rentalFee: 0,
    depositRefund: 0,
    lateFee: 0,
    damageFee: 0,
  });
});
