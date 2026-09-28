import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { PublicDressSummaryDto } from '../../dtos/public-dress.response.dto';
import { publicSummaryRowSchema, toPublicSummary } from '../public-dress.projection';
import { ListPublicDressesQuery } from './list-public-dresses.query';

/**
 * Anonymous catalogue list (R5): published listings with ≥ 1 ACTIVE dress — the inner joins drop
 * a listing whose dresses were all retired, without unpublishing it. Hot first, then the most
 * recently first-published. R6: explicit column whitelist, nothing from `dresses` but the price.
 */
@QueryHandler(ListPublicDressesQuery)
export class ListPublicDressesQueryHandler
  implements IQueryHandler<ListPublicDressesQuery, PublicDressSummaryDto[]>
{
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async execute(query: ListPublicDressesQuery): Promise<PublicDressSummaryDto[]> {
    const occasion = query.occasion
      ? sql.fragment`AND ${query.occasion} = ANY(l.occasions)`
      : sql.fragment``;
    const limit = query.limit ? sql.fragment`LIMIT ${query.limit}` : sql.fragment``;

    const rows = await this.pool.any(sql.type(publicSummaryRowSchema)`
      SELECT
        l.slug, l.name, l.tagline, l.occasions, l.is_hot, l.first_published_at,
        l.retail_price, l.photo_urls,
        min(d.rental_price)::int AS rental_price
      FROM dress_listings l
      JOIN dress_listing_items i ON i.listing_id = l.id
      JOIN dresses d ON d.id = i.dress_id AND d.status = 'active'
      WHERE l.published_at IS NOT NULL ${occasion}
      GROUP BY l.id
      ORDER BY l.is_hot DESC, l.first_published_at DESC, l.slug ASC
      ${limit}
    `);

    const now = new Date();
    return rows.map((row) => toPublicSummary(row, now));
  }
}
