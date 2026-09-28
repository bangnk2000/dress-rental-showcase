import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { toDate } from '../../../../libs/utils/date';
import { dressListingSchema } from '../../database/dress-listing.persistence.model';
import { Occasion } from '../../domain/occasion.value-object';
import { ListingDressDto, ListingDto } from '../../dtos/listing.response.dto';
import { GetListingQuery } from './get-listing.query';

const dressRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  size_label: z.string().nullable(),
  rental_price: z.number().int(),
  status: z.enum(['active', 'retired']),
});

/** One call draws the whole CMS edit screen: the listing + its attached dresses. Null = 404. */
@QueryHandler(GetListingQuery)
export class GetListingQueryHandler implements IQueryHandler<GetListingQuery, ListingDto | null> {
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async execute(query: GetListingQuery): Promise<ListingDto | null> {
    const row = await this.pool.maybeOne(sql.type(dressListingSchema)`
      SELECT * FROM dress_listings WHERE id = ${query.listingId}
    `);
    if (!row) return null;

    const dresses = await this.pool.any(sql.type(dressRowSchema)`
      SELECT d.id, d.code, d.name, d.size_label, d.rental_price, d.status
      FROM dress_listing_items i JOIN dresses d ON d.id = i.dress_id
      WHERE i.listing_id = ${query.listingId}
      ORDER BY d.code ASC
    `);

    return Object.assign(new ListingDto(), {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      occasions: row.occasions as Occasion[],
      retailPrice: row.retail_price,
      specs: {
        material: row.material,
        silhouette: row.silhouette,
        length: row.length,
        color: row.color,
        occasionsText: row.occasions_text,
      },
      photoUrls: [...row.photo_urls],
      isHot: row.is_hot,
      publishedAt: row.published_at === null ? null : toDate(row.published_at).toISOString(),
      firstPublishedAt:
        row.first_published_at === null ? null : toDate(row.first_published_at).toISOString(),
      dresses: dresses.map((dress) =>
        Object.assign(new ListingDressDto(), {
          id: dress.id,
          code: dress.code,
          name: dress.name,
          sizeLabel: dress.size_label,
          rentalPrice: dress.rental_price,
          status: dress.status,
        }),
      ),
      createdAt: toDate(row.created_at).toISOString(),
      updatedAt: toDate(row.updated_at).toISOString(),
    });
  }
}
