import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import {
  DRESS_LOOKUP,
  DressLookupPort,
} from '../../application/ports/dress-lookup.port';
import { bookedRangeRowSchema, toBookedRangeDto } from '../booked-range.projection';
import { BookedRangeListResponseDto } from './list-booked-ranges.response.dto';
import { ListBookedRangesQuery } from './list-booked-ranges.query';

@QueryHandler(ListBookedRangesQuery)
export class ListBookedRangesQueryHandler
  implements IQueryHandler<ListBookedRangesQuery, BookedRangeListResponseDto | null>
{
  constructor(
    @Inject(DB_POOL) private readonly pool: DatabasePool,
    @Inject(DRESS_LOOKUP) private readonly dressLookup: DressLookupPort,
  ) {}

  // Read side: straight SQL, projected to the response shape. Null = unknown
  // dress (the controller maps it to 404).
  async execute(query: ListBookedRangesQuery): Promise<BookedRangeListResponseDto | null> {
    const [dress] = await this.dressLookup.findByIds([query.dressId]);
    if (!dress) return null;

    // ::text keeps ranges as literals — slonik would otherwise hand back
    // parsed range objects that daterange.ts does not speak.
    const rows = await this.pool.any(sql.type(bookedRangeRowSchema)`
      SELECT r.id AS rental_id, r.period::text AS period, r.status,
             ri.blocked_period::text AS blocked_period
      FROM rental_items ri
      JOIN rentals r ON r.id = ri.rental_id
      WHERE ri.dress_id = ${query.dressId} AND ri.blocking
      ORDER BY lower(r.period)
    `);

    return Object.assign(new BookedRangeListResponseDto(), {
      data: rows.map(toBookedRangeDto),
    });
  }
}
