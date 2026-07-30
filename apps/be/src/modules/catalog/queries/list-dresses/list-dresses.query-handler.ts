import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { toDate } from '../../../../libs/utils/date';
import { dressSchema } from '../../database/dress.persistence.model';
import { DressResponseDto } from '../../dtos/dress.response.dto';
import { ListDressesQuery } from './list-dresses.query';
import { DressListResponseDto } from './list-dresses.response.dto';

const countSchema = z.object({ total: z.number() });

@QueryHandler(ListDressesQuery)
export class ListDressesQueryHandler
  implements IQueryHandler<ListDressesQuery, DressListResponseDto>
{
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  // Read side: straight SQL, projected to the response shape.
  async execute(query: ListDressesQuery): Promise<DressListResponseDto> {
    const filters = [];
    if (query.q) {
      const like = `%${query.q}%`;
      filters.push(sql.fragment`(code ILIKE ${like} OR name ILIKE ${like})`);
    }
    if (query.status) {
      filters.push(sql.fragment`status = ${query.status}`);
    }
    const where =
      filters.length > 0
        ? sql.fragment`WHERE ${sql.join(filters, sql.fragment` AND `)}`
        : sql.fragment``;

    const rows = await this.pool.query(sql.type(dressSchema)`
      SELECT * FROM dresses ${where}
      ORDER BY code ASC
      LIMIT ${query.limit} OFFSET ${query.offset}
    `);
    const { total } = await this.pool.one(
      sql.type(countSchema)`SELECT count(*)::int AS total FROM dresses ${where}`,
    );

    return Object.assign(new DressListResponseDto(), {
      data: rows.rows.map((row) =>
        Object.assign(new DressResponseDto(), {
          id: row.id,
          code: row.code,
          name: row.name,
          sizeLabel: row.size_label,
          rentalPrice: row.rental_price,
          depositAmount: row.deposit_amount,
          status: row.status,
          notes: row.notes,
          photoUrls: [...row.photo_urls],
          createdAt: toDate(row.created_at).toISOString(),
        }),
      ),
      count: total,
      limit: query.limit,
      page: query.page,
    });
  }
}
