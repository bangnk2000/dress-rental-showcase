import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateRentalItemRequestDto {
  @ApiProperty({ format: 'uuid', description: 'Dress to book' })
  @IsUUID()
  readonly dressId!: string;

  @ApiPropertyOptional({
    example: 1200000,
    description: 'Agreed price in VND (integer); omit to use the dress standard price',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly price?: number;
}

/**
 * FR-RENT-14: money already handed over at booking, recorded in the same transaction as the
 * rental. Absent amount = not collected (the ledger has no 0₫ rows, BR-4).
 */
export class CreateRentalCollectDto {
  @ApiPropertyOptional({ example: 3000000, description: 'Deposit collected at booking (VND ≥ 1)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  readonly deposit?: number;

  @ApiPropertyOptional({
    example: 1500000,
    description: 'Rental fee collected at booking (VND ≥ 1)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  readonly rentalFee?: number;
}

export class CreateRentalRequestDto {
  @ApiProperty({ example: 'Nguyễn Thị Hoa' })
  @IsString()
  @Length(1, 200)
  readonly customerName!: string;

  @ApiProperty({ example: '0903123456' })
  @IsString()
  @Matches(/^[0-9+ ().-]{6,20}$/)
  readonly customerPhone!: string;

  @ApiProperty({ example: '2026-08-01', description: 'First rental day (inclusive)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly startDate!: string;

  @ApiProperty({ example: '2026-08-03', description: 'Last rental day (inclusive)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly endDate!: string;

  @ApiPropertyOptional({ example: 'Khách quen, hẹn lấy 9h sáng' })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  readonly notes?: string;

  @ApiPropertyOptional({
    example: 100000,
    description:
      'Discount on the rental fee in VND (integer, FR-RENT-11); omit or 0 = none. Must not exceed the sum of the item prices (400 otherwise).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly discountAmount?: number;

  @ApiPropertyOptional({
    type: CreateRentalCollectDto,
    description:
      'FR-RENT-14: money handed over at booking — written to the ledger in the same transaction; omit = nothing collected',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRentalCollectDto)
  readonly collect?: CreateRentalCollectDto;

  @ApiProperty({ type: [CreateRentalItemRequestDto], description: 'Dresses to book (1..n)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CreateRentalItemRequestDto) => item.dressId)
  @ValidateNested({ each: true })
  @Type(() => CreateRentalItemRequestDto)
  readonly items!: CreateRentalItemRequestDto[];
}
