import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { NotFoundException } from '../../../../libs/exceptions';
import { staffUserSchema } from '../../database/staff-user.persistence.model';
import { MeQuery } from './me.query';
import { MeResponseDto } from './me.response.dto';

@QueryHandler(MeQuery)
export class MeQueryHandler implements IQueryHandler<MeQuery, MeResponseDto> {
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  // Read side: straight to the DB, projected to the response shape.
  async execute(query: MeQuery): Promise<MeResponseDto> {
    const row = await this.pool.maybeOne(
      sql.type(staffUserSchema)`SELECT * FROM staff_users WHERE id = ${query.staffId} LIMIT 1`,
    );
    if (!row) throw new NotFoundException('Staff account not found');
    return Object.assign(new MeResponseDto(), {
      id: row.id,
      username: row.username,
      name: row.name,
      role: row.role,
    });
  }
}
