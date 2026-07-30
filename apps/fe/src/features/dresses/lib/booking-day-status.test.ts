import { expect, test } from 'vitest';

import type { BookedRangeDto } from '@/api/generated/model';
import { BookedRangeDtoStatus } from '@/api/generated/model';

import { dayBookingStatus } from './booking-day-status';

const range: BookedRangeDto = {
  rentalId: 'rental-1',
  startDate: '2099-08-01',
  endDate: '2099-08-03',
  blockedUntilDate: '2099-08-05',
  status: BookedRangeDtoStatus.booked,
};

test('days inside the rental period are rented (bounds inclusive)', () => {
  expect(dayBookingStatus('2099-08-01', [range])).toBe('rented');
  expect(dayBookingStatus('2099-08-02', [range])).toBe('rented');
  expect(dayBookingStatus('2099-08-03', [range])).toBe('rented');
});

test('days after the rental up to blockedUntilDate are buffer', () => {
  expect(dayBookingStatus('2099-08-04', [range])).toBe('buffer');
  expect(dayBookingStatus('2099-08-05', [range])).toBe('buffer');
});

test('days outside the blocked interval are free', () => {
  expect(dayBookingStatus('2099-07-31', [range])).toBe('free');
  expect(dayBookingStatus('2099-08-06', [range])).toBe('free');
  expect(dayBookingStatus('2099-08-06', [])).toBe('free');
});

test('a rented day of one booking wins over the buffer of another', () => {
  const next: BookedRangeDto = {
    ...range,
    rentalId: 'rental-2',
    startDate: '2099-08-04',
    endDate: '2099-08-06',
    blockedUntilDate: '2099-08-08',
  };
  expect(dayBookingStatus('2099-08-04', [range, next])).toBe('rented');
});
