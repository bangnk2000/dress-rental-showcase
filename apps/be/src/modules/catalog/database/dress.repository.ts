import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabasePool, DatabaseTransactionConnection, sql } from 'slonik';
import { SqlRepositoryBase } from '../../../libs/db/sql-repository.base';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import { ConflictException } from '../../../libs/exceptions';
import { LOGGER_PORT, LoggerPort } from '../../../libs/ports/logger.port';
import { DressEntity } from '../domain/dress.entity';
import { DressCodeConflictError } from '../application/ports/dress-code-conflict.error';
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

  /**
   * `dresses` carries exactly ONE uniqueness constraint — the code — so a uniqueness conflict on
   * either write can only mean the code was taken. Translating it here is what keeps a race from
   * being answered as a generic 409 envelope while the identical pre-check answers a named
   * outcome; the two must be indistinguishable to the client.
   */
  async insert(entity: DressEntity): Promise<void> {
    await this.translateCodeConflict(() => super.insert(entity));
  }

  /**
   * Dress write + ONE price-history row, atomically (FR-CAT-06 R1): the log line commits with
   * the price it records, or neither does. insertRow/upsertRow are the same primitives the
   * plain insert/save use.
   */
  async insertWithHistory(entity: DressEntity, changedById: string | null): Promise<void> {
    await this.translateCodeConflict(() =>
      this.writeInTransaction(entity, async (conn, record) => {
        await this.insertRow(conn, record);
        await this.insertHistoryRow(conn, record, changedById);
      }),
    );
  }

  async saveWithPriceHistory(entity: DressEntity, changedById: string | null): Promise<void> {
    await this.translateCodeConflict(() =>
      this.writeInTransaction(entity, async (conn, record) => {
        await this.upsertRow(conn, record);
        await this.insertHistoryRow(conn, record, changedById);
      }),
    );
  }

  private async insertHistoryRow(
    conn: DatabaseTransactionConnection,
    record: DressModel,
    changedById: string | null,
  ): Promise<void> {
    await conn.query(sql.unsafe`
      INSERT INTO dress_price_history (dress_id, rental_price, deposit_amount, changed_by)
      VALUES (${record.id}, ${record.rental_price}, ${record.deposit_amount}, ${changedById})
    `);
  }

  async save(entity: DressEntity): Promise<void> {
    await this.translateCodeConflict(() => super.save(entity));
  }

  private async translateCodeConflict(write: () => Promise<void>): Promise<void> {
    try {
      await write();
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new DressCodeConflictError(error);
      }
      throw error;
    }
  }

  async findOneByCode(code: string): Promise<DressEntity | null> {
    const row = await this.pool.maybeOne(
      sql.type(this.schema)`SELECT * FROM dresses WHERE code = ${code.toUpperCase()} LIMIT 1`,
    );
    return row ? this.mapper.toDomain(row) : null;
  }
}
