import { Inject, Injectable } from '@nestjs/common';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import { RentalLookupPort } from '../application/ports/rental-lookup.port';

const existsSchema = z.object({ found: z.number() });

/** Reads the rentals-owned TABLE directly — the boundary, not a code import. */
@Injectable()
export class RentalLookupAdapter implements RentalLookupPort {
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async exists(rentalId: string): Promise<boolean> {
    const { found } = await this.pool.one(sql.type(existsSchema)`
      SELECT count(*)::int AS found FROM rentals WHERE id = ${rentalId}
    `);
    return found > 0;
  }
}
