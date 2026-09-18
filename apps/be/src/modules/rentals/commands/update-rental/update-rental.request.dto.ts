import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateRentalItemRequestDto } from '../create-rental/create-rental.request.dto';

/**
 * FR-RENT-13 (owner-only): partial update of an OPEN rental. Omit a field to keep it; `notes`
 * accepts `null` to clear. `items` REPLACES the whole list — a dress already on the rental keeps
 * its row and agreed price (unless `price` is sent), a new dress gets the catalog standard price
 * (unless `price` is sent), a dress left out is removed. Status is NOT here: pickup / return /
 * cancel are their own endpoints.
 */
export class UpdateRentalRequestDto {
  @ApiPropertyOptional({ example: 'Nguyễn Thị Hoa' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  readonly customerName?: string;

  @ApiPropertyOptional({ example: '0903123456' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+ ().-]{6,20}$/)
  readonly customerPhone?: string;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'New first rental day (inclusive); merged with the current end date if that is omitted',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-03',
    description: 'New last rental day (inclusive); merged with the current start date if that is omitted',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly endDate?: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: 'Khách quen, hẹn lấy 9h sáng',
    description: 'null clears it',
  })
  @IsOptional() // skips null too: null IS the valid "clear it" value
  @IsString()
  @Length(1, 2000)
  readonly notes?: string | null;

  @ApiPropertyOptional({
    example: 100000,
    description:
      'Discount on the rental fee in VND (integer, FR-RENT-11); must not exceed the sum of the (new) item prices (400 otherwise)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly discountAmount?: number;

  @ApiPropertyOptional({
    type: [CreateRentalItemRequestDto],
    description:
      'The FULL new dress list (1..n) — replaces the current one. Omit price to keep the agreed price of a kept dress / take the standard price of an added dress',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CreateRentalItemRequestDto) => item.dressId)
  @ValidateNested({ each: true })
  @Type(() => CreateRentalItemRequestDto)
  readonly items?: CreateRentalItemRequestDto[];
}
