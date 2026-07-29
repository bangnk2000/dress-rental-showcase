import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabasePool, sql } from 'slonik';
import { SqlRepositoryBase } from '../../../libs/db/sql-repository.base';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import { LOGGER_PORT, LoggerPort } from '../../../libs/ports/logger.port';
import { DressEntity } from '../domain/dress.entity';
import { DressRepositoryPort } from '../application/ports/dress.repository.port';
import { DressMapper } from './dress.mapper';
import { DressModel, dressSchema } from './dress.persistence.model';

@Injectable()
export class DressRepository
  extends SqlRepositoryBase<DressEntity, DressModel>
  implements DressRepositoryPort
{
  protected tableName = 'dresses';
  protected schema = dressSchema;

  constructor(
    @Inject(DB_POOL) pool: DatabasePool,
    mapper: DressMapper,
    @Inject(LOGGER_PORT) logger: LoggerPort,
    eventEmitter: EventEmitter2,
  ) {
    super(pool, mapper, logger, eventEmitter);
  }

  async findOneByCode(code: string): Promise<DressEntity | null> {
    const row = await this.pool.maybeOne(
      sql.type(this.schema)`SELECT * FROM dresses WHERE code = ${code.toUpperCase()} LIMIT 1`,
    );
    return row ? this.mapper.toDomain(row) : null;
  }
}
