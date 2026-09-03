import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabasePool, sql } from 'slonik';
import { SqlRepositoryBase } from '../../../libs/db/sql-repository.base';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import { ConflictException } from '../../../libs/exceptions';
import { LOGGER_PORT, LoggerPort } from '../../../libs/ports/logger.port';
import { StaffUserEntity } from '../domain/staff-user.entity';
import { StaffUserRepositoryPort } from '../application/ports/staff-user.repository.port';
import { UsernameConflictError } from '../application/ports/username-conflict.error';
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

  /**
   * `staff_users` carries exactly ONE uniqueness constraint — lower(username) — so a uniqueness
   * conflict on a write can only mean the username was taken (same reasoning as DressRepository).
   */
  async insert(entity: StaffUserEntity): Promise<void> {
    await this.translateUsernameConflict(() => super.insert(entity));
  }

  async save(entity: StaffUserEntity): Promise<void> {
    await this.translateUsernameConflict(() => super.save(entity));
  }

  private async translateUsernameConflict(write: () => Promise<void>): Promise<void> {
    try {
      await write();
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new UsernameConflictError(error);
      }
      throw error;
    }
  }

  async findOneByUsername(username: string): Promise<StaffUserEntity | null> {
    const row = await this.pool.maybeOne(
      sql.type(this.schema)`
        SELECT * FROM staff_users WHERE lower(username) = ${username.toLowerCase()} LIMIT 1
      `,
    );
    return row ? this.mapper.toDomain(row) : null;
  }

  async findAll(): Promise<StaffUserEntity[]> {
    // No pagination by design: the shop has fewer than ten people (spec §4).
    const rows = await this.pool.any(
      sql.type(this.schema)`SELECT * FROM staff_users ORDER BY created_at, id`,
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }
}
