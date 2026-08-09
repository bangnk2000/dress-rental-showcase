import { Inject, Injectable } from '@nestjs/common';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import { DressLookupPort, DressSnapshot } from '../application/ports/dress-lookup.port';

const dressLookupSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.string(),
  rental_price: z.number().int(),
  deposit_amount: z.number().int(),
});

/**
 * Reads the catalog-owned dresses TABLE directly (read side may hit the pool;
 * the rental_items FK already couples the schemas). Importing catalog CODE
 * would violate the no-cross-module rule — this adapter is the boundary.
 */
@Injectable()
export class DressLookupAdapter implements DressLookupPort {
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async findByIds(dressIds: string[]): Promise<DressSnapshot[]> {
    if (dressIds.length === 0) return [];
    const rows = await this.pool.any(sql.type(dressLookupSchema)`
      SELECT id, code, name, status, rental_price, deposit_amount FROM dresses
      WHERE id = ANY(${sql.array(dressIds, 'uuid')})
    `);
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      retired: row.status === 'retired',
      rentalPrice: row.rental_price,
      depositAmount: row.deposit_amount,
    }));
  }
}
