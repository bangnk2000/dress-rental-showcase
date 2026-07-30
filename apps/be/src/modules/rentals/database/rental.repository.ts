import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CheckExclusionConstraintViolationError,
  DatabasePool,
  DatabaseTransactionConnection,
  sql,
} from 'slonik';
import { z } from 'zod';
import { SqlRepositoryBase } from '../../../libs/db/sql-repository.base';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import { AggregateID } from '../../../libs/ddd/entity.base';
import { ConflictException } from '../../../libs/exceptions';
import { LOGGER_PORT, LoggerPort } from '../../../libs/ports/logger.port';
import { RentalRepositoryPort } from '../application/ports/rental.repository.port';
import { RentalEntity } from '../domain/rental.entity';
import { RentalPeriod } from '../domain/rental-period.value-object';
import { toDateRangeLiteral } from './daterange';
import { RentalMapper } from './rental.mapper';
import {
  RentalItemRow,
  RentalModel,
  RentalRow,
  rentalAggregateSchema,
  rentalItemRowSchema,
  rentalRowSchema,
} from './rental.persistence.model';

const dressIdSchema = z.object({ dress_id: z.string() });

/**
 * The aggregate spans rentals + rental_items, so the single-table helpers of
 * SqlRepositoryBase are bypassed: insert/save/findOneById are overridden to
 * write/read both tables inside writeInTransaction (events still publish
 * atomically with the rows).
 */
@Injectable()
export class RentalRepository
  extends SqlRepositoryBase<RentalEntity, RentalModel>
  implements RentalRepositoryPort
{
  protected tableName = 'rentals';
  protected schema = rentalAggregateSchema;

  constructor(
    @Inject(DB_POOL) pool: DatabasePool,
    mapper: RentalMapper,
    @Inject(LOGGER_PORT) logger: LoggerPort,
    eventEmitter: EventEmitter2,
  ) {
    super(pool, mapper, logger, eventEmitter);
  }

  override async insert(entity: RentalEntity): Promise<void> {
    await this.writeAggregate(entity, false);
  }

  override async save(entity: RentalEntity): Promise<void> {
    await this.writeAggregate(entity, true);
  }

  override async findOneById(id: AggregateID): Promise<RentalEntity | null> {
    const rental = await this.pool.maybeOne(
      sql.type(rentalRowSchema)`SELECT * FROM rentals WHERE id = ${id}`,
    );
    if (!rental) return null;
    const items = await this.pool.any(
      sql.type(rentalItemRowSchema)`SELECT * FROM rental_items WHERE rental_id = ${id} ORDER BY id`,
    );
    return this.mapper.toDomain({ rental, items: [...items] });
  }

  async findBlockedDressIds(
    dressIds: string[],
    blockedPeriod: RentalPeriod,
  ): Promise<string[]> {
    const range = toDateRangeLiteral(blockedPeriod.start, blockedPeriod.end);
    const rows = await this.pool.any(sql.type(dressIdSchema)`
      SELECT DISTINCT dress_id FROM rental_items
      WHERE blocking
        AND dress_id = ANY(${sql.array(dressIds, 'uuid')})
        AND blocked_period && ${range}::daterange
    `);
    return rows.map((row) => row.dress_id);
  }

  private async writeAggregate(entity: RentalEntity, upsert: boolean): Promise<void> {
    try {
      await this.writeInTransaction(entity, async (conn, record) => {
        await this.writeRentalRow(conn, record.rental, upsert);
        for (const item of record.items) {
          await this.writeItemRow(conn, item, upsert);
        }
      });
    } catch (error) {
      if (error instanceof CheckExclusionConstraintViolationError) {
        // The EXCLUDE constraint fired: a race beat the availability pre-check.
        throw new ConflictException(
          'A dress is already booked for an overlapping period',
          error as Error,
        );
      }
      throw error;
    }
  }

  private async writeRentalRow(
    conn: DatabaseTransactionConnection,
    row: RentalRow,
    upsert: boolean,
  ): Promise<void> {
    const insert = sql.fragment`
      INSERT INTO rentals (id, customer_name, customer_phone, period, status, notes, created_at, updated_at)
      VALUES (${row.id}, ${row.customer_name}, ${row.customer_phone}, ${row.period}::daterange,
              ${row.status}, ${row.notes}, ${row.created_at as string}, ${row.updated_at as string})
    `;
    await conn.query(
      upsert
        ? sql.unsafe`${insert} ON CONFLICT (id) DO UPDATE SET
            customer_name = EXCLUDED.customer_name, customer_phone = EXCLUDED.customer_phone,
            period = EXCLUDED.period, status = EXCLUDED.status, notes = EXCLUDED.notes,
            updated_at = EXCLUDED.updated_at`
        : sql.unsafe`${insert}`,
    );
  }

  private async writeItemRow(
    conn: DatabaseTransactionConnection,
    row: RentalItemRow,
    upsert: boolean,
  ): Promise<void> {
    const insert = sql.fragment`
      INSERT INTO rental_items (id, rental_id, dress_id, price, blocked_period, blocking)
      VALUES (${row.id}, ${row.rental_id}, ${row.dress_id}, ${row.price},
              ${row.blocked_period}::daterange, ${row.blocking})
    `;
    await conn.query(
      upsert
        ? sql.unsafe`${insert} ON CONFLICT (id) DO UPDATE SET
            price = EXCLUDED.price, blocked_period = EXCLUDED.blocked_period,
            blocking = EXCLUDED.blocking`
        : sql.unsafe`${insert}`,
    );
  }
}
