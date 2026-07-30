import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import {
  RENTAL_LOOKUP,
  RentalLookupPort,
} from '../../application/ports/rental-lookup.port';
import { paymentRowSchema, toPaymentDto } from '../payment.projection';
import { PaymentListResponseDto } from './list-payments.response.dto';
import { ListPaymentsQuery } from './list-payments.query';

@QueryHandler(ListPaymentsQuery)
export class ListPaymentsQueryHandler
  implements IQueryHandler<ListPaymentsQuery, PaymentListResponseDto | null>
{
  constructor(
    @Inject(DB_POOL) private readonly pool: DatabasePool,
    @Inject(RENTAL_LOOKUP) private readonly rentalLookup: RentalLookupPort,
  ) {}

  /** Null = unknown rental (controller maps it to 404). */
  async execute(query: ListPaymentsQuery): Promise<PaymentListResponseDto | null> {
    if (!(await this.rentalLookup.exists(query.rentalId))) return null;

    // A settlement inserts its rows in ONE transaction (same created_at) —
    // kind breaks the tie so the order stays deterministic.
    const rows = await this.pool.any(sql.type(paymentRowSchema)`
      SELECT id, kind, amount, note, created_at
      FROM payments WHERE rental_id = ${query.rentalId}
      ORDER BY created_at, kind, id
    `);

    return Object.assign(new PaymentListResponseDto(), {
      data: rows.map(toPaymentDto),
    });
  }
}
