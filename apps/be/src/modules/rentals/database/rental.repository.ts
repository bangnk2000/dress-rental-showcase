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
import { LOGGER_PORT, LoggerPort } from '../../../libs/ports/logger.port';
import { DepositBasisChangedError } from '../application/ports/deposit-basis-changed.error';
import { LedgerNotEmptyError } from '../application/ports/ledger-not-empty.error';
import { RentalItemsOverlapError } from '../application/ports/rental-overlap.error';
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
const collectedDepositSchema = z.object({ collected: z.number().int() });
const movementCountSchema = z.object({ movements: z.number().int() });

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

  /**
   * The settlement's refund is computed from the deposit on file, and that number can change right
   * up until this write: another device may record a collection while the return dialog is open.
   * Re-reading it here, under the rental's row lock and in the SAME transaction as the status
   * flip, is what makes the two operations take turns — payments/record-collection locks the very
   * same row before inserting, so either it commits first and this read sees it, or it arrives
   * after the flip and its own closed-rental rule refuses it.
   */
  async saveReturned(
    entity: RentalEntity,
    expectedDepositCollected: number | null,
  ): Promise<void> {
    await this.writeAggregate(entity, true, async (conn, record) => {
      if (expectedDepositCollected === null) return;
      await conn.query(sql.unsafe`
        SELECT id FROM rentals WHERE id = ${record.rental.id} FOR UPDATE
      `);
      const { collected } = await conn.one(sql.type(collectedDepositSchema)`
        SELECT coalesce(sum(amount), 0)::int AS collected
        FROM payments WHERE rental_id = ${record.rental.id} AND kind = 'deposit'
      `);
      if (collected !== expectedDepositCollected) {
        throw new DepositBasisChangedError(collected);
      }
    });
  }

  /**
   * A cancel is only legal while the ledger is empty (FR-RENT-10 §6.Q2). Checked HERE, under the
   * rental's row lock and in the SAME transaction as the status flip — record-collection locks
   * the very same row before inserting, so either its money lands first and this count sees it,
   * or the cancel commits first and the collection's own closed-rental rule refuses it. Lock
   * order is rentals → payments on both sides, so no deadlock.
   */
  async saveCancelled(entity: RentalEntity): Promise<void> {
    await this.writeAggregate(entity, true, async (conn, record) => {
      await conn.query(sql.unsafe`
        SELECT id FROM rentals WHERE id = ${record.rental.id} FOR UPDATE
      `);
      const { movements } = await conn.one(sql.type(movementCountSchema)`
        SELECT count(*)::int AS movements FROM payments WHERE rental_id = ${record.rental.id}
      `);
      if (movements > 0) {
        throw new LedgerNotEmptyError();
      }
    });
  }

  override async findOneById(id: AggregateID): Promise<RentalEntity | null> {
    // ::text keeps ranges as literals for the mapper — slonik would otherwise
    // hand back parsed range objects that daterange.ts does not speak.
    const rental = await this.pool.maybeOne(sql.type(rentalRowSchema)`
      SELECT id, customer_name, customer_phone, period::text AS period,
             status, notes, discount_amount, created_at, updated_at
      FROM rentals WHERE id = ${id}
    `);
    if (!rental) return null;
    const items = await this.pool.any(sql.type(rentalItemRowSchema)`
      SELECT id, rental_id, dress_id, price,
             blocked_period::text AS blocked_period, blocking
      FROM rental_items WHERE rental_id = ${id} ORDER BY id
    `);
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

  private async writeAggregate(
    entity: RentalEntity,
    upsert: boolean,
    /** Runs INSIDE the write transaction, before any row is touched. Throwing aborts the write. */
    precondition?: (conn: DatabaseTransactionConnection, record: RentalModel) => Promise<void>,
  ): Promise<void> {
    try {
      await this.writeInTransaction(entity, async (conn, record) => {
        await precondition?.(conn, record);
        await this.writeRentalRow(conn, record.rental, upsert);
        for (const item of record.items) {
          await this.writeItemRow(conn, item, upsert);
        }
      });
    } catch (error) {
      if (error instanceof CheckExclusionConstraintViolationError) {
        // The EXCLUDE constraint fired: a race beat the availability pre-check. Translated into
        // the port's own exception so no slonik type escapes the adapter; create-rental turns it
        // into the SAME rejected_dress_unavailable outcome as the pre-check (ADR 0001 §2).
        throw new RentalItemsOverlapError(error as Error);
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
      INSERT INTO rentals (id, customer_name, customer_phone, period, status, notes, discount_amount,
                           created_at, updated_at)
      VALUES (${row.id}, ${row.customer_name}, ${row.customer_phone}, ${row.period}::daterange,
              ${row.status}, ${row.notes}, ${row.discount_amount},
              ${row.created_at as string}, ${row.updated_at as string})
    `;
    await conn.query(
      upsert
        ? sql.unsafe`${insert} ON CONFLICT (id) DO UPDATE SET
            customer_name = EXCLUDED.customer_name, customer_phone = EXCLUDED.customer_phone,
            period = EXCLUDED.period, status = EXCLUDED.status, notes = EXCLUDED.notes,
            discount_amount = EXCLUDED.discount_amount, updated_at = EXCLUDED.updated_at`
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
