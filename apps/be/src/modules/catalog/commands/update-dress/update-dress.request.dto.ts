import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';

/**
 * Partial update: omit a field to keep it; send `null` to clear a nullable
 * one (sizeLabel, notes). Status is NOT here — retiring is a separate,
 * owner-only endpoint.
 */
export class UpdateDressRequestDto {
  @ApiPropertyOptional({ example: 'VD-012', description: 'New unique shop code' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/)
  readonly code?: string;

  @ApiPropertyOptional({ example: 'Váy cưới đuôi cá ren trắng' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  readonly name?: string;

  @ApiPropertyOptional({ example: 'M', nullable: true, type: String, description: 'null clears it' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  readonly sizeLabel?: string | null;

  @ApiPropertyOptional({ example: 1500000, description: 'Rental price in VND (integer)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly rentalPrice?: number;

  @ApiPropertyOptional({ example: 3000000, description: 'Standard deposit in VND (integer)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly depositAmount?: number;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'null clears it' })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  readonly notes?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Photo links (http/https), max 10 — replaces the whole list',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(/^https?:\/\/\S+$/, { each: true })
  @Length(1, 2000, { each: true })
  readonly photoUrls?: string[];

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Category id; omit = keep, explicit null = clear the assignment',
  })
  @IsOptional() // skips null too: null IS the valid "clear it" value
  @IsUUID()
  readonly categoryId?: string | null;
}
