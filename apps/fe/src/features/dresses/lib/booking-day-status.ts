import type { BookedRangeDto } from '@/api/generated/model';

export type DayBookingStatus = 'rented' | 'buffer' | 'free';

/**
 * Status of one calendar day against the blocking bookings of a dress.
 * ISO yyyy-mm-dd strings compare correctly as strings — no Date parsing.
 * A rented day wins over another booking's buffer day.
 */
export function dayBookingStatus(
  date: string,
  ranges: readonly BookedRangeDto[],
): DayBookingStatus {
  if (ranges.some((range) => range.startDate <= date && date <= range.endDate)) {
    return 'rented';
  }
  if (ranges.some((range) => range.endDate < date && date <= range.blockedUntilDate)) {
    return 'buffer';
  }
  return 'free';
}
