import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DressListingRefDto } from '../dtos/dress.response.dto';

const refRowSchema = z.object({ dress_id: z.string(), id: z.string(), name: z.string() });

/** dressId → the listings it belongs to (by name), for `DressResponseDto.listings`. One query. */
export async function listingRefsByDress(
  pool: DatabasePool,
  dressIds: readonly string[],
): Promise<Map<string, DressListingRefDto[]>> {
  const byDress = new Map<string, DressListingRefDto[]>();
  if (dressIds.length === 0) return byDress;
  const rows = await pool.any(sql.type(refRowSchema)`
    SELECT i.dress_id, l.id, l.name
    FROM dress_listing_items i JOIN dress_listings l ON l.id = i.listing_id
    WHERE i.dress_id = ANY(${sql.array([...dressIds], 'uuid')})
    ORDER BY l.name ASC
  `);
  for (const row of rows) {
    const refs = byDress.get(row.dress_id) ?? [];
    refs.push(Object.assign(new DressListingRefDto(), { id: row.id, name: row.name }));
    byDress.set(row.dress_id, refs);
  }
  return byDress;
}
