import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { toDate } from '../../../../libs/utils/date';
import { staffUserSchema } from '../../database/staff-user.persistence.model';
import { ListUsersQuery } from './list-users.query';
import { UserDto, UserListResponseDto } from './list-users.response.dto';

@QueryHandler(ListUsersQuery)
export class ListUsersQueryHandler implements IQueryHandler<ListUsersQuery, UserListResponseDto> {
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  // Read side: straight to the DB. No pagination by design — the shop has fewer than ten people.
  // password_hash never leaves this handler (fields are listed, not spread).
  async execute(): Promise<UserListResponseDto> {
    const rows = await this.pool.any(
      sql.type(staffUserSchema)`SELECT * FROM staff_users ORDER BY created_at, id`,
    );
    const data: UserDto[] = rows.map((row) =>
      Object.assign(new UserDto(), {
        id: row.id,
        username: row.username,
        name: row.name,
        role: row.role,
        active: row.active,
        createdAt: toDate(row.created_at).toISOString(),
      }),
    );
    return Object.assign(new UserListResponseDto(), { data });
  }
}
