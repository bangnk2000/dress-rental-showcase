import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

/**
 * rentals/cancel-with-refund. Every field optional: an empty body is the empty-ledger cancel it
 * always was. With money on file the caller MUST state the basis it saw (both expected amounts),
 * or the server answers rejected_cancel_basis_changed with what is on file.
 */
export class CancelRentalRequestDto {
  @ApiPropertyOptional({
    example: 3000000,
    description: 'Deposit total on file that the refunds were computed from (VND integer)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly expectedDepositCollected?: number;

  @ApiPropertyOptional({
    example: 1500000,
    description: 'Rental fee total on file that the refunds were computed from (VND integer)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly expectedRentalFeeCollected?: number;

  @ApiPropertyOptional({
    example: 3000000,
    description: 'Deposit handed back to the customer (VND integer); omitted = 0',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly depositRefund?: number;

  @ApiPropertyOptional({
    example: 1500000,
    description: 'Rental fee handed back to the customer (VND integer); omitted = 0',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly rentalFeeRefund?: number;

  @ApiPropertyOptional({
    example: 'Khách huỷ trước 2 ngày, giữ 30% tiền thuê',
    description: 'Written on every refund row; required when any money is kept (owner only)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  readonly note?: string;
}
