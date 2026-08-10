import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

/**
 * FR-PAY-02: both amounts are optional and both may be absent — "nothing to record" is a business
 * outcome, not a shape error (docs/design/payments/record-collection.md §2). Min is 1, not 0: a
 * 0₫ movement is not a movement, and "not collected" is the ABSENCE of the field.
 */
export class RecordCollectionRequestDto {
  @ApiPropertyOptional({
    example: 3000000,
    description: 'Deposit actually collected, in VND (integer ≥ 1)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  readonly deposit?: number;

  @ApiPropertyOptional({
    example: 1500000,
    description: 'Rental fee actually collected, in VND (integer ≥ 1)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  readonly rentalFee?: number;

  @ApiPropertyOptional({
    example: 'Khách chuyển khoản trước',
    description: 'Written onto every movement this call records',
  })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  readonly note?: string;
}
