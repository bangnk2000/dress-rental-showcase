import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * FR-RENT-14. Optional body: omitted (or empty) = hand out a rental whose deposit is already on
 * file. With `depositCollected` the deposit taken at the counter is recorded in the same
 * transaction as the handover.
 */
export class PickupRentalRequestDto {
  @ApiPropertyOptional({
    example: 3000000,
    description:
      'Deposit collected at the counter as the dresses go out (VND integer ≥ 1). Required when no deposit is on file (rejected_deposit_not_collected otherwise); refused when one is (rejected_deposit_already_recorded).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  readonly depositCollected?: number;
}
