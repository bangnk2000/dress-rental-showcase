import { z } from 'zod';
import { fromDateRangeLiteral } from '../database/daterange';
import { BookedRangeDto } from '../dtos/booked-range.response.dto';

/** Row shape shared by the rentals read queries (rental_items ⋈ rentals). */
export const bookedRangeRowSchema = z.object({
  rental_id: z.string(),
  period: z.string(),
  status: z.enum(['booked', 'out', 'returned', 'cancelled']),
  blocked_period: z.string(),
});

export type BookedRangeRow = z.infer<typeof bookedRangeRowSchema>;

export function toBookedRangeDto(row: BookedRangeRow): BookedRangeDto {
  const period = fromDateRangeLiteral(row.period);
  const blocked = fromDateRangeLiteral(row.blocked_period);
  return Object.assign(new BookedRangeDto(), {
    rentalId: row.rental_id,
    startDate: period.start,
    endDate: period.endInclusive,
    blockedUntilDate: blocked.endInclusive,
    status: row.status,
  });
}
