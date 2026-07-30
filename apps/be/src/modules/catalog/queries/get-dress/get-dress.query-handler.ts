import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { toDate } from '../../../../libs/utils/date';
import { dressSchema } from '../../database/dress.persistence.model';
import { DressResponseDto } from '../../dtos/dress.response.dto';
import { GetDressQuery } from './get-dress.query';

@QueryHandler(GetDressQuery)
export class GetDressQueryHandler
  implements IQueryHandler<GetDressQuery, DressResponseDto | null>
{
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  // Read side: straight SQL, projected to the response shape. Null = not found
  // (the controller maps it to 404).
  async execute(query: GetDressQuery): Promise<DressResponseDto | null> {
    const row = await this.pool.maybeOne(sql.type(dressSchema)`
      SELECT * FROM dresses WHERE id = ${query.dressId}
    `);
    if (!row) return null;

    return Object.assign(new DressResponseDto(), {
      id: row.id,
      code: row.code,
      name: row.name,
      sizeLabel: row.size_label,
      rentalPrice: row.rental_price,
      depositAmount: row.deposit_amount,
      status: row.status,
      notes: row.notes,
      createdAt: toDate(row.created_at).toISOString(),
    });
  }
}
