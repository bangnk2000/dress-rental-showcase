import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import {
  DRESS_LOOKUP,
  DressLookupPort,
} from '../../application/ports/dress-lookup.port';
import {
  rentalListItemRowSchema,
  rentalListRowSchema,
  toRentalListItemDtos,
} from '../rental-list.projection';
import { RentalListResponseDto } from './list-rentals.response.dto';
import { ListRentalsQuery } from './list-rentals.query';

const countSchema = z.object({ total: z.number() });

@QueryHandler(ListRentalsQuery)
export class ListRentalsQueryHandler
  implements IQueryHandler<ListRentalsQuery, RentalListResponseDto>
{
  constructor(
    @Inject(DB_POOL) private readonly pool: DatabasePool,
    @Inject(DRESS_LOOKUP) private readonly dressLookup: DressLookupPort,
  ) {}

  /** Pages over RENTALS (not item rows); items + dress names ride along per page. */
  async execute(query: ListRentalsQuery): Promise<RentalListResponseDto> {
    const filters = [];
    if (query.q) {
      const like = `%${query.q}%`;
      filters.push(sql.fragment`(customer_name ILIKE ${like} OR customer_phone ILIKE ${like})`);
    }
    if (query.status) {
      filters.push(sql.fragment`status = ${query.status}`);
    }
    const where =
      filters.length > 0
        ? sql.fragment`WHERE ${sql.join(filters, sql.fragment` AND `)}`
        : sql.fragment``;

    // ::text keeps ranges as literals — slonik would otherwise hand back
    // parsed range objects that daterange.ts does not speak.
    const rentals = await this.pool.any(sql.type(rentalListRowSchema)`
      SELECT id, customer_name, customer_phone, status, period::text AS period,
             notes, created_at
      FROM rentals ${where}
      ORDER BY created_at DESC, id
      LIMIT ${query.limit} OFFSET ${query.offset}
    `);
    const { total } = await this.pool.one(
      sql.type(countSchema)`SELECT count(*)::int AS total FROM rentals ${where}`,
    );

    const rentalIds = rentals.map((rental) => rental.id);
    const items =
      rentalIds.length > 0
        ? await this.pool.any(sql.type(rentalListItemRowSchema)`
            SELECT rental_id, dress_id, price FROM rental_items
            WHERE rental_id = ANY(${sql.array(rentalIds, 'uuid')})
            ORDER BY id
          `)
        : [];
    const dresses = await this.dressLookup.findByIds([
      ...new Set(items.map((item) => item.dress_id)),
    ]);

    return Object.assign(new RentalListResponseDto(), {
      data: toRentalListItemDtos(rentals, items, dresses),
      count: total,
      limit: query.limit,
      page: query.page,
    });
  }
}
