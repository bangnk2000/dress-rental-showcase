import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import {
  DRESS_LOOKUP,
  DressLookupPort,
} from '../../application/ports/dress-lookup.port';
import { todayBoardRowSchema, toTodayBoardDto } from '../today-board.projection';
import { TodayBoardResponseDto } from './get-today-board.response.dto';
import { GetTodayBoardQuery } from './get-today-board.query';

/** yyyy-mm-dd of "now" in the server's timezone — the FE sends its own date anyway. */
function serverToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

@QueryHandler(GetTodayBoardQuery)
export class GetTodayBoardQueryHandler
  implements IQueryHandler<GetTodayBoardQuery, TodayBoardResponseDto>
{
  constructor(
    @Inject(DB_POOL) private readonly pool: DatabasePool,
    @Inject(DRESS_LOOKUP) private readonly dressLookup: DressLookupPort,
  ) {}

  /**
   * The morning board: due OUT = rentals starting on the date that are still
   * 'booked' (to hand out) OR already 'out' (handed out during the day — they
   * stay on the board so the day's hand-outs are visible in one place);
   * due BACK = not-yet-returned rentals whose inclusive last day is the date;
   * OVERDUE = not-yet-returned rentals whose inclusive last day is already
   * past. Periods are half-open [start, end+1), so the inclusive last day is
   * upper - 1.
   */
  async execute(query: GetTodayBoardQuery): Promise<TodayBoardResponseDto> {
    const date = query.date ?? serverToday();

    // ::text keeps ranges as literals — slonik would otherwise hand back
    // parsed range objects that daterange.ts does not speak.
    const rows = await this.pool.any(sql.type(todayBoardRowSchema)`
      SELECT r.id AS rental_id, r.customer_name, r.customer_phone, r.status,
             r.period::text AS period, ri.dress_id, ri.price,
             (lower(r.period) = ${date}::date) AS due_out,
             (upper(r.period) - 1 = ${date}::date) AS due_back,
             (upper(r.period) - 1 < ${date}::date) AS overdue,
             -- FR-RENT-14: per RENTAL, not per item row — a subquery, never a JOIN that would
             -- multiply the deposit by the number of dresses.
             (SELECT coalesce(sum(p.amount), 0)::int FROM payments p
               WHERE p.rental_id = r.id AND p.kind = 'deposit') AS deposit_collected
      FROM rentals r
      JOIN rental_items ri ON ri.rental_id = r.id
      WHERE r.status IN ('booked', 'out')
        AND (lower(r.period) = ${date}::date OR upper(r.period) - 1 <= ${date}::date)
      ORDER BY r.created_at, r.id
    `);

    const dressIds = [...new Set(rows.map((row) => row.dress_id))];
    const dresses = await this.dressLookup.findByIds(dressIds);

    return toTodayBoardDto(date, rows, dresses);
  }
}
