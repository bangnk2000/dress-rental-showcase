import { z } from 'zod';
import { DressSnapshot } from '../application/ports/dress-lookup.port';
import { fromDateRangeLiteral } from '../database/daterange';
import {
  TodayBoardRentalDto,
  TodayBoardResponseDto,
} from './get-today-board/get-today-board.response.dto';

/**
 * Row shape of the today-board read (rentals ⋈ rental_items, one row per
 * item). The SQL computes the two memberships so the projection only groups.
 */
export const todayBoardRowSchema = z.object({
  rental_id: z.string(),
  customer_name: z.string(),
  customer_phone: z.string(),
  status: z.enum(['booked', 'out', 'returned', 'cancelled']),
  period: z.string(),
  dress_id: z.string(),
  due_out: z.boolean(),
  due_back: z.boolean(),
  overdue: z.boolean(),
});

export type TodayBoardRow = z.infer<typeof todayBoardRowSchema>;

/**
 * Groups item rows into rental entries and splits them over the two lists.
 * A single-day rental legitimately appears on BOTH (hand out AND take back).
 * Row order (the SQL's ORDER BY) decides list order; dresses sort by code.
 */
export function toTodayBoardDto(
  date: string,
  rows: readonly TodayBoardRow[],
  dresses: readonly DressSnapshot[],
): TodayBoardResponseDto {
  const dressById = new Map(dresses.map((dress) => [dress.id, dress]));
  const entries = new Map<
    string,
    { dto: TodayBoardRentalDto; dueOut: boolean; dueBack: boolean; overdue: boolean }
  >();

  for (const row of rows) {
    let entry = entries.get(row.rental_id);
    if (!entry) {
      const period = fromDateRangeLiteral(row.period);
      entry = {
        dto: Object.assign(new TodayBoardRentalDto(), {
          rentalId: row.rental_id,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          status: row.status,
          startDate: period.start,
          endDate: period.endInclusive,
          dresses: [],
        }),
        dueOut: row.due_out,
        dueBack: row.due_back,
        overdue: row.overdue,
      };
      entries.set(row.rental_id, entry);
    }
    const dress = dressById.get(row.dress_id);
    if (!dress) {
      // rental_items.dress_id is a FK — a miss means the lookup was fed wrong ids.
      throw new Error(`Dress ${row.dress_id} missing from lookup`);
    }
    entry.dto.dresses.push({ dressId: dress.id, code: dress.code, name: dress.name });
  }

  for (const entry of entries.values()) {
    entry.dto.dresses.sort((a, b) => a.code.localeCompare(b.code));
  }

  const all = [...entries.values()];
  return Object.assign(new TodayBoardResponseDto(), {
    date,
    dueOut: all.filter((entry) => entry.dueOut).map((entry) => entry.dto),
    dueBack: all.filter((entry) => entry.dueBack).map((entry) => entry.dto),
    overdue: all.filter((entry) => entry.overdue).map((entry) => entry.dto),
  });
}
