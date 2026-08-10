import { Inject, Injectable } from '@nestjs/common';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import {
  RentalLookupPort,
  RentalStatusSnapshot,
} from '../application/ports/rental-lookup.port';

const statusSchema = z.object({
  status: z.enum(['booked', 'out', 'returned', 'cancelled']),
});

/** Reads the rentals-owned TABLE directly — the boundary, not a code import. */
@Injectable()
export class RentalLookupAdapter implements RentalLookupPort {
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async findStatus(rentalId: string): Promise<RentalStatusSnapshot | null> {
    const row = await this.pool.maybeOne(sql.type(statusSchema)`
      SELECT status FROM rentals WHERE id = ${rentalId}
    `);
    return row?.status ?? null;
  }
}
