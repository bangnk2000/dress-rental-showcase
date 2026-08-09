import { Inject, Injectable } from '@nestjs/common';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import { StaffLookupPort } from '../application/ports/staff-lookup.port';

const staffNameSchema = z.object({ id: z.string(), name: z.string() });

/** Reads the identity-owned TABLE directly — the boundary, not a code import. */
@Injectable()
export class StaffLookupAdapter implements StaffLookupPort {
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async findNamesByIds(staffIds: string[]): Promise<Map<string, string>> {
    if (staffIds.length === 0) return new Map();
    const rows = await this.pool.any(sql.type(staffNameSchema)`
      SELECT id, name FROM staff_users WHERE id = ANY(${sql.array(staffIds, 'uuid')})
    `);
    return new Map(rows.map((row) => [row.id, row.name]));
  }
}
