import { toBookedRangeDto } from './booked-range.projection';

// Postgres normalizes daterange to half-open [start,end+1) — the projection
// must hand the FE inclusive last days for both the rental and the block.
test('maps a rental_items ⋈ rentals row to inclusive calendar dates', () => {
  const dto = toBookedRangeDto({
    rental_id: '00000000-0000-4000-8000-000000000100',
    period: '[2026-08-01,2026-08-04)',
    status: 'booked',
    blocked_period: '[2026-08-01,2026-08-06)',
  });

  expect(dto).toEqual({
    rentalId: '00000000-0000-4000-8000-000000000100',
    startDate: '2026-08-01',
    endDate: '2026-08-03',
    blockedUntilDate: '2026-08-05',
    status: 'booked',
  });
});

test('keeps inclusive-bound literals as-is (no off-by-one)', () => {
  const dto = toBookedRangeDto({
    rental_id: '00000000-0000-4000-8000-000000000101',
    period: '[2026-09-10,2026-09-10]',
    status: 'out',
    blocked_period: '[2026-09-10,2026-09-12]',
  });

  expect(dto.startDate).toBe('2026-09-10');
  expect(dto.endDate).toBe('2026-09-10');
  expect(dto.blockedUntilDate).toBe('2026-09-12');
  expect(dto.status).toBe('out');
});
