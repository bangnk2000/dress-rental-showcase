import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import {
  DRESS_LOOKUP,
  DressLookupPort,
} from '../../application/ports/dress-lookup.port';
import { toDateRangeLiteral } from '../../database/daterange';
import { RentalPeriod } from '../../domain/rental-period.value-object';
import { bookedRangeRowSchema, toBookedRangeDto } from '../booked-range.projection';
import { AvailabilityResponseDto } from './check-availability.response.dto';
import { CheckAvailabilityQuery } from './check-availability.query';

@QueryHandler(CheckAvailabilityQuery)
export class CheckAvailabilityQueryHandler
  implements IQueryHandler<CheckAvailabilityQuery, AvailabilityResponseDto | null>
{
  constructor(
    @Inject(DB_POOL) private readonly pool: DatabasePool,
    @Inject(DRESS_LOOKUP) private readonly dressLookup: DressLookupPort,
    private readonly config: ConfigService,
  ) {}

  /**
   * Mirrors the create-rental precondition exactly: a booking [start, end]
   * would block [start, end + cleaning buffer], so THAT interval is tested
   * against the existing blocking blocked_periods (which carry their own
   * buffers already). Null = unknown dress (controller maps to 404).
   */
  async execute(query: CheckAvailabilityQuery): Promise<AvailabilityResponseDto | null> {
    const [dress] = await this.dressLookup.findByIds([query.dressId]);
    if (!dress) return null;

    const period = RentalPeriod.create(query.startDate, query.endDate);
    const bufferDays = this.config.getOrThrow<number>('CLEANING_BUFFER_DAYS');
    const blockedPeriod = period.extendEndByDays(bufferDays);
    const range = toDateRangeLiteral(blockedPeriod.start, blockedPeriod.end);

    // ::text keeps ranges as literals — slonik would otherwise hand back
    // parsed range objects that daterange.ts does not speak.
    const rows = await this.pool.any(sql.type(bookedRangeRowSchema)`
      SELECT r.id AS rental_id, r.period::text AS period, r.status,
             ri.blocked_period::text AS blocked_period
      FROM rental_items ri
      JOIN rentals r ON r.id = ri.rental_id
      WHERE ri.dress_id = ${query.dressId} AND ri.blocking
        AND ri.blocked_period && ${range}::daterange
      ORDER BY lower(r.period)
    `);

    return Object.assign(new AvailabilityResponseDto(), {
      dressId: query.dressId,
      startDate: query.startDate,
      endDate: query.endDate,
      available: !dress.retired && rows.length === 0,
      conflicts: rows.map(toBookedRangeDto),
    });
  }
}
