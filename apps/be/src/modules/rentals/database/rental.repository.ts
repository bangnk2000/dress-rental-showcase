import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
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
import { LedgerBasisChangedError } from '../application/ports/ledger-basis-changed.error';
import { LedgerNotEmptyError } from '../application/ports/ledger-not-empty.error';
import { RentalItemsOverlapError } from '../application/ports/rental-overlap.error';
import { RentalStateChangedError } from '../application/ports/rental-state-changed.error';
import {
  CancelSettlement,
  RentalRepositoryPort,
} from '../application/ports/rental.repository.port';
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
const ledgerSchema = z.object({
  movements: z.number().int(),
  deposit: z.number().int(),
  rental_fee: z.number().int(),
});
const rentalStatusSchema = z.object({
  status: z.enum(['booked', 'out', 'returned', 'cancelled']),
});

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
      // The status flip is only legal from `out`, re-read under the lock: a cancel committed
      // since the load must not be overwritten by a stale "returned" (PR #38 review C1).
      await this.lockExpectingStatus(conn, record.rental.id, 'out');
      if (expectedDepositCollected === null) return;
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
   * Pickup (booked → out) re-reads the status under the rental's row lock — the lock cancel,
   * return, edit and record-collection take — so a cancel that committed after the service loaded
   * the rental is never overwritten: without it a stale pickup reopens a cancelled, refunded
   * rental as `out` with blocking items, and its return could refund the deposit twice.
   */
  async savePickedUp(entity: RentalEntity): Promise<void> {
    await this.writeAggregate(entity, true, async (conn, record) => {
      await this.lockExpectingStatus(conn, record.rental.id, 'booked');
    });
  }

  /** `SELECT … FOR UPDATE` the rental row; anything but `expected` → `RentalStateChangedError`. */
  private async lockExpectingStatus(
    conn: DatabaseTransactionConnection,
    rentalId: string,
    expected: 'booked' | 'out',
  ): Promise<void> {
    const { status } = await conn.one(sql.type(rentalStatusSchema)`
      SELECT status FROM rentals WHERE id = ${rentalId} FOR UPDATE
    `);
    if (status !== expected) throw new RentalStateChangedError(status);
  }

  /**
   * The ledger rules of a cancel (rentals/cancel-with-refund) are checked HERE, under the rental's
   * row lock and in the SAME transaction as the status flip — record-collection locks the very
   * same row before inserting, so either its money lands first and this read sees it, or the
   * cancel commits first and the collection's own closed-rental rule refuses it. Lock order is
   * rentals → payments on both sides, so no deadlock. The refund rows are written in this same
   * transaction (the payments table is written directly, as PaymentRecorderAdapter does —
   * apps/be Deviation #4), so a cancel is recorded whole or not at all.
   */
  async saveCancelled(entity: RentalEntity, settlement: CancelSettlement | null): Promise<void> {
    await this.writeAggregate(entity, true, async (conn, record) => {
      const rentalId = record.rental.id;
      const { status } = await conn.one(sql.type(rentalStatusSchema)`
        SELECT status FROM rentals WHERE id = ${rentalId} FOR UPDATE
      `);
      if (status !== 'booked' && status !== 'out') {
        throw new RentalStateChangedError(status);
      }
      const ledger = await conn.one(sql.type(ledgerSchema)`
        SELECT count(*)::int AS movements,
               coalesce(sum(amount) FILTER (WHERE kind = 'deposit'), 0)::int AS deposit,
               coalesce(sum(amount) FILTER (WHERE kind = 'rental_fee'), 0)::int AS rental_fee
        FROM payments WHERE rental_id = ${rentalId}
      `);
      const claimsMatch =
        settlement !== null &&
        settlement.expectedDepositCollected === ledger.deposit &&
        settlement.expectedRentalFeeCollected === ledger.rental_fee;

      if (ledger.movements === 0) {
        if (settlement !== null && !claimsMatch) throw new LedgerBasisChangedError(0, 0);
        return;
      }
      if (status !== 'booked') throw new LedgerNotEmptyError();
      if (settlement === null || !claimsMatch) {
        throw new LedgerBasisChangedError(ledger.deposit, ledger.rental_fee);
      }

      for (const refund of settlement.refunds) {
        if (refund.amount <= 0) continue;
        await conn.query(sql.unsafe`
          INSERT INTO payments (id, rental_id, kind, amount, note)
          VALUES (${randomUUID()}, ${rentalId}, ${refund.kind}, ${refund.amount}, ${refund.note})
        `);
      }
    });
  }

  /**
   * An edit (FR-RENT-13) is only legal while the rental is OPEN, and "open" can change right up
   * until this write: staff may cancel or return the rental while the owner has the edit form
   * open. Re-read HERE, under the rental's row lock — the very lock saveCancelled/saveReturned
   * and record-collection take — so the two operations take turns: either the close commits
   * first and this read refuses the stale aggregate, or the edit commits first and the close
   * runs on the edited rental. Writing the stale aggregate would set status back to booked and
   * items back to blocking — a closed rental silently reopened.
   */
  async saveUpdated(entity: RentalEntity): Promise<void> {
    await this.writeAggregate(entity, true, async (conn, record) => {
      const { status } = await conn.one(sql.type(rentalStatusSchema)`
        SELECT status FROM rentals WHERE id = ${record.rental.id} FOR UPDATE
      `);
      if (status !== 'booked' && status !== 'out') {
        throw new RentalStateChangedError(status);
      }
    });
  }

  override async findOneById(id: AggregateID): Promise<RentalEntity | null> {
    // ::text keeps ranges as literals for the mapper — slonik would otherwise
    // hand back parsed range objects that daterange.ts does not speak.
    const rental = await this.pool.maybeOne(sql.type(rentalRowSchema)`
      SELECT id, customer_name, customer_phone, period::text AS period,
             status, notes, discount_amount, cancel_reason, created_at, updated_at
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
    options: { excludeRentalId?: string } = {},
  ): Promise<string[]> {
    const range = toDateRangeLiteral(blockedPeriod.start, blockedPeriod.end);
    // An edit replaces the rental's own booking, so its own rows are not a conflict (the EXCLUDE
    // constraint agrees: an updated row is never checked against itself).
    const notSelf = options.excludeRentalId
      ? sql.fragment`AND rental_id <> ${options.excludeRentalId}`
      : sql.fragment``;
    const rows = await this.pool.any(sql.type(dressIdSchema)`
      SELECT DISTINCT dress_id FROM rental_items
      WHERE blocking
        AND dress_id = ANY(${sql.array(dressIds, 'uuid')})
        AND blocked_period && ${range}::daterange
        ${notSelf}
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
        if (upsert) {
          // The aggregate is the truth: items it no longer holds leave the table (an edit dropped
          // a dress, FR-RENT-13 §6.Q5). Deleted BEFORE the upserts so a removed row can never
          // collide with what replaces it. Every pre-existing save path keeps all its items, so
          // for them this is a no-op.
          await this.deleteRemovedItems(conn, record);
        }
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

  private async deleteRemovedItems(
    conn: DatabaseTransactionConnection,
    record: RentalModel,
  ): Promise<void> {
    const keptIds = record.items.map((item) => item.id);
    await conn.query(sql.unsafe`
      DELETE FROM rental_items
      WHERE rental_id = ${record.rental.id}
        AND NOT (id = ANY(${sql.array(keptIds, 'uuid')}))
    `);
  }

  private async writeRentalRow(
    conn: DatabaseTransactionConnection,
    row: RentalRow,
    upsert: boolean,
  ): Promise<void> {
    const insert = sql.fragment`
      INSERT INTO rentals (id, customer_name, customer_phone, period, status, notes, discount_amount,
                           cancel_reason, created_at, updated_at)
      VALUES (${row.id}, ${row.customer_name}, ${row.customer_phone}, ${row.period}::daterange,
              ${row.status}, ${row.notes}, ${row.discount_amount}, ${row.cancel_reason},
              ${row.created_at as string}, ${row.updated_at as string})
    `;
    await conn.query(
      upsert
        ? sql.unsafe`${insert} ON CONFLICT (id) DO UPDATE SET
            customer_name = EXCLUDED.customer_name, customer_phone = EXCLUDED.customer_phone,
            period = EXCLUDED.period, status = EXCLUDED.status, notes = EXCLUDED.notes,
            discount_amount = EXCLUDED.discount_amount, cancel_reason = EXCLUDED.cancel_reason,
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
