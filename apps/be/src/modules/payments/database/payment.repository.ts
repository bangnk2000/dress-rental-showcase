import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabasePool, sql, UniqueIntegrityConstraintViolationError } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import { SqlRepositoryBase } from '../../../libs/db/sql-repository.base';
import { LOGGER_PORT, LoggerPort } from '../../../libs/ports/logger.port';
import {
  CollectionConflictError,
  RentalNotOpenError,
} from '../application/ports/collection-conflict.error';
import {
  PaymentRepositoryPort,
  RecordedCollection,
} from '../application/ports/payment.repository.port';
import { PaymentEntity } from '../domain/payment.entity';
import { COLLECTION_KINDS } from '../domain/payment.types';
import { PaymentMapper } from './payment.mapper';
import { PaymentModel, paymentSchema } from './payment.persistence.model';

const collectedSchema = z.object({
  kind: z.enum(['deposit', 'rental_fee']),
  amount: z.number().int(),
});

const rentalStatusSchema = z.object({
  status: z.enum(['booked', 'out', 'returned', 'cancelled']),
});

@Injectable()
export class PaymentRepository
  extends SqlRepositoryBase<PaymentEntity, PaymentModel>
  implements PaymentRepositoryPort
{
  protected tableName = 'payments';
  protected schema = paymentSchema;

  constructor(
    @Inject(DB_POOL) pool: DatabasePool,
    mapper: PaymentMapper,
    @Inject(LOGGER_PORT) logger: LoggerPort,
    eventEmitter: EventEmitter2,
  ) {
    super(pool, mapper, logger, eventEmitter);
  }

  async findCollected(rentalId: string): Promise<RecordedCollection[]> {
    const rows = await this.pool.any(sql.type(collectedSchema)`
      SELECT kind, amount FROM payments
      WHERE rental_id = ${rentalId}
        AND kind = ANY(${sql.array([...COLLECTION_KINDS], 'text')})
      ORDER BY kind
    `);
    return rows.map((row) => ({ kind: row.kind, amount: row.amount }));
  }

  /**
   * Both movements land or neither does (R5), so this writes its own transaction instead of
   * calling insert() twice. The UNIQUE violation is translated at the adapter edge: the service
   * re-reads what is on file and answers with the same outcome as its pre-check.
   *
   * The rental's status is re-read HERE, `FOR UPDATE`, rather than trusted from the service's
   * pre-check: that read happens in its own transaction, so a return committing in between would
   * otherwise let money land on a closed rental (R4). The lock makes this insert and the return
   * flow's status write take turns. Both take the `rentals` row before touching `payments`, so the
   * ordering cannot deadlock. Reading the rentals TABLE here is the same boundary the context's
   * lookup adapter uses (Deviation #4) — it never imports rentals CODE.
   */
  async recordCollection(rentalId: string, payments: PaymentEntity[]): Promise<void> {
    try {
      await this.pool.transaction(async (conn) => {
        const rental = await conn.maybeOne(sql.type(rentalStatusSchema)`
          SELECT status FROM rentals WHERE id = ${rentalId} FOR UPDATE
        `);
        if (!rental) {
          throw new RentalNotOpenError(null);
        }
        if (rental.status === 'returned' || rental.status === 'cancelled') {
          throw new RentalNotOpenError(rental.status);
        }

        for (const payment of payments) {
          const row = this.mapper.toPersistence(payment);
          await conn.query(sql.unsafe`
            INSERT INTO payments (id, rental_id, kind, amount, note, created_at)
            VALUES (${row.id}, ${row.rental_id}, ${row.kind}, ${row.amount}, ${row.note},
                    ${(row.created_at as Date).toISOString()})
          `);
        }
        for (const payment of payments) {
          await payment.publishEvents(this.logger, this.eventEmitter);
        }
      });
    } catch (error) {
      if (error instanceof UniqueIntegrityConstraintViolationError) {
        throw new CollectionConflictError(error as Error);
      }
      throw error;
    }
  }
}
