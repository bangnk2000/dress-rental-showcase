import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import {
  PublicDressDetailDto,
  PublicDressSpecsDto,
  PublicSizeDto,
} from '../../dtos/public-dress.response.dto';
import {
  compareSizeLabels,
  FREESIZE_LABEL,
  publicImages,
  publicSummaryRowSchema,
  toPublicSummary,
} from '../public-dress.projection';
import { GetPublicDressQuery } from './get-public-dress.query';

const detailRowSchema = publicSummaryRowSchema.extend({
  /** Internal — used for the sizes query, NEVER copied to the DTO (R6). */
  listing_id: z.string(),
  description: z.string(),
  material: z.string().nullable(),
  silhouette: z.string().nullable(),
  length: z.string().nullable(),
  color: z.string().nullable(),
  occasions_text: z.string().nullable(),
});

const sizeRowSchema = z.object({ label: z.string(), available: z.boolean() });

/**
 * One public listing by slug — same visibility rule as the list (R5): published AND ≥ 1 active
 * dress, else null (→ 404 envelope). Sizes cover every attached dress; "available" = ≥ 1 active
 * dress of that size, bookings deliberately not considered (spec §6.B).
 */
@QueryHandler(GetPublicDressQuery)
export class GetPublicDressQueryHandler
  implements IQueryHandler<GetPublicDressQuery, PublicDressDetailDto | null>
{
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async execute(query: GetPublicDressQuery): Promise<PublicDressDetailDto | null> {
    const row = await this.pool.maybeOne(sql.type(detailRowSchema)`
      SELECT
        l.id AS listing_id,
        l.slug, l.name, l.tagline, l.occasions, l.is_hot, l.first_published_at,
        l.retail_price, l.photo_urls, l.description,
        l.material, l.silhouette, l.length, l.color, l.occasions_text,
        min(d.rental_price)::int AS rental_price
      FROM dress_listings l
      JOIN dress_listing_items i ON i.listing_id = l.id
      JOIN dresses d ON d.id = i.dress_id AND d.status = 'active'
      WHERE l.slug = ${query.slug} AND l.published_at IS NOT NULL
      GROUP BY l.id
    `);
    if (!row) return null;

    const sizes = await this.pool.any(sql.type(sizeRowSchema)`
      SELECT
        COALESCE(d.size_label, ${FREESIZE_LABEL}) AS label,
        bool_or(d.status = 'active') AS available
      FROM dress_listing_items i JOIN dresses d ON d.id = i.dress_id
      WHERE i.listing_id = ${row.listing_id}
      GROUP BY 1
    `);

    return Object.assign(new PublicDressDetailDto(), {
      ...toPublicSummary(row, new Date()),
      description: row.description,
      images: publicImages(row.name, row.photo_urls),
      sizes: [...sizes]
        .sort((a, b) => compareSizeLabels(a.label, b.label))
        .map((size) =>
          Object.assign(new PublicSizeDto(), { label: size.label, available: size.available }),
        ),
      specs: Object.assign(new PublicDressSpecsDto(), {
        material: row.material,
        silhouette: row.silhouette,
        length: row.length,
        color: row.color,
        occasions: row.occasions_text,
      }),
    });
  }
}
