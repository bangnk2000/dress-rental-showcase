import { toPaymentDto } from './payment.projection';

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
