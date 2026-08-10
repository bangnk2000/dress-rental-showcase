import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { toDate } from '../../../../libs/utils/date';
import { ListPriceHistoryQuery } from './list-price-history.query';
import {
  PriceHistoryEntryDto,
  PriceHistoryListResponseDto,
} from './list-price-history.response.dto';

const rowSchema = z.object({
  rental_price: z.number().int(),
  deposit_amount: z.number().int(),
  changed_at: z.union([z.number(), z.string(), z.date()]),
  changed_by: z.string().nullable(),
  changed_by_name: z.string().nullable(),
});

@QueryHandler(ListPriceHistoryQuery)
export class ListPriceHistoryQueryHandler
  implements IQueryHandler<ListPriceHistoryQuery, PriceHistoryListResponseDto>
{
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  // The changer's display name is a read-side LEFT JOIN on staff_users — a documented
  // schema-level coupling (deviation #4 family, like DressLookupAdapter), chosen over a
  // one-JOIN port+adapter ceremony. Users are never deleted (identity R3), names just rename.
  // Same-timestamp rows tie-break on id — the payments lesson.
  async execute(query: ListPriceHistoryQuery): Promise<PriceHistoryListResponseDto> {
    const rows = await this.pool.any(sql.type(rowSchema)`
      SELECT h.rental_price, h.deposit_amount, h.changed_at,
             h.changed_by, s.name AS changed_by_name
      FROM dress_price_history h
      LEFT JOIN staff_users s ON s.id = h.changed_by
      WHERE h.dress_id = ${query.dressId}
      ORDER BY h.changed_at DESC, h.id DESC
    `);
    const data: PriceHistoryEntryDto[] = rows.map((row) =>
      Object.assign(new PriceHistoryEntryDto(), {
        rentalPrice: row.rental_price,
        depositAmount: row.deposit_amount,
        changedAt: toDate(row.changed_at).toISOString(),
        changedBy:
          row.changed_by === null
            ? null
            : { id: row.changed_by, name: row.changed_by_name ?? '' },
      }),
    );
    return Object.assign(new PriceHistoryListResponseDto(), { data });
  }
}
