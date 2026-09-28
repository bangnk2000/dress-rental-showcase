import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { toDate } from '../../../../libs/utils/date';
import { Occasion } from '../../domain/occasion.value-object';
import { ListingListItemDto, ListingListResponseDto } from '../../dtos/listing.response.dto';
import { ListListingsQuery } from './list-listings.query';

const timestamp = z.union([z.number(), z.string(), z.date()]);

const rowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  occasions: z.array(z.string()),
  is_hot: z.boolean(),
  cover_url: z.string().nullable(),
  published_at: timestamp.nullable(),
  first_published_at: timestamp.nullable(),
  updated_at: timestamp,
  dress_count: z.number().int(),
  active_dress_count: z.number().int(),
  active_size_count: z.number().int(),
});

const isoOrNull = (value: number | string | Date | null): string | null =>
  value === null ? null : toDate(value).toISOString();

@QueryHandler(ListListingsQuery)
export class ListListingsQueryHandler
  implements IQueryHandler<ListListingsQuery, ListingListResponseDto>
{
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async execute(): Promise<ListingListResponseDto> {
    const rows = await this.pool.any(sql.type(rowSchema)`
      SELECT
        l.id, l.slug, l.name, l.occasions, l.is_hot,
        l.photo_urls[1] AS cover_url,
        l.published_at, l.first_published_at, l.updated_at,
        count(d.id)::int AS dress_count,
        count(d.id) FILTER (WHERE d.status = 'active')::int AS active_dress_count,
        count(DISTINCT COALESCE(d.size_label, 'Freesize'))
          FILTER (WHERE d.status = 'active')::int AS active_size_count
      FROM dress_listings l
      LEFT JOIN dress_listing_items i ON i.listing_id = l.id
      LEFT JOIN dresses d ON d.id = i.dress_id
      GROUP BY l.id
      ORDER BY l.updated_at DESC, l.slug ASC
    `);

    return Object.assign(new ListingListResponseDto(), {
      data: rows.map((row) =>
        Object.assign(new ListingListItemDto(), {
          id: row.id,
          slug: row.slug,
          name: row.name,
          occasions: row.occasions as Occasion[],
          isHot: row.is_hot,
          coverUrl: row.cover_url,
          publishedAt: isoOrNull(row.published_at),
          firstPublishedAt: isoOrNull(row.first_published_at),
          dressCount: row.dress_count,
          activeDressCount: row.active_dress_count,
          activeSizeCount: row.active_size_count,
          visibleOnWeb: row.published_at !== null && row.active_dress_count > 0,
          updatedAt: toDate(row.updated_at).toISOString(),
        }),
      ),
    });
  }
}
