import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabasePool, sql } from 'slonik';
import { SqlRepositoryBase } from '../../../libs/db/sql-repository.base';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import { LOGGER_PORT, LoggerPort } from '../../../libs/ports/logger.port';
import { StaffUserEntity } from '../domain/staff-user.entity';
import { StaffUserRepositoryPort } from '../application/ports/staff-user.repository.port';
import { StaffUserMapper } from './staff-user.mapper';
import { StaffUserModel, staffUserSchema } from './staff-user.persistence.model';

@Injectable()
export class StaffUserRepository
  extends SqlRepositoryBase<StaffUserEntity, StaffUserModel>
  implements StaffUserRepositoryPort
{
  protected tableName = 'staff_users';
  protected schema = staffUserSchema;

  constructor(
    @Inject(DB_POOL) pool: DatabasePool,
    mapper: StaffUserMapper,
    @Inject(LOGGER_PORT) logger: LoggerPort,
    eventEmitter: EventEmitter2,
  ) {
    super(pool, mapper, logger, eventEmitter);
  }

  async findOneByEmail(email: string): Promise<StaffUserEntity | null> {
    const row = await this.pool.maybeOne(
      sql.type(this.schema)`SELECT * FROM staff_users WHERE email = ${email.toLowerCase()} LIMIT 1`,
    );
    return row ? this.mapper.toDomain(row) : null;
  }
}
