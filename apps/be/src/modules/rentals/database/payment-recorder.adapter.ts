import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabasePool, sql } from 'slonik';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import {
  PaymentRecorderPort,
  SettlementPayment,
} from '../application/ports/payment-recorder.port';

/**
 * Writes the payments-owned TABLE directly (the payments context is schema
 * only — no code to import). One INSERT per movement, all in one transaction
 * so a settlement is recorded whole or not at all.
 */
@Injectable()
export class PaymentRecorderAdapter implements PaymentRecorderPort {
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async recordSettlement(rentalId: string, payments: SettlementPayment[]): Promise<void> {
    if (payments.length === 0) return;
    await this.pool.transaction(async (conn) => {
      for (const payment of payments) {
        await conn.query(sql.unsafe`
          INSERT INTO payments (id, rental_id, kind, amount, note)
          VALUES (${randomUUID()}, ${rentalId}, ${payment.kind},
                  ${payment.amount}, ${payment.note})
        `);
      }
    });
  }
}
