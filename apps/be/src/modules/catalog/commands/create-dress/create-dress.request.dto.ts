import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateDressRequestDto {
  @ApiProperty({ example: 'VD-012', description: 'Unique shop code' })
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,19}$/)
  readonly code!: string;

  @ApiProperty({ example: 'Váy cưới đuôi cá ren trắng' })
  @IsString()
  @Length(1, 200)
  readonly name!: string;

  @ApiPropertyOptional({ example: 'M' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  readonly sizeLabel?: string;

  @ApiProperty({ example: 1500000, description: 'Rental price in VND (integer)' })
  @IsInt()
  @Min(0)
  readonly rentalPrice!: number;

  @ApiProperty({ example: 3000000, description: 'Standard deposit in VND (integer)' })
  @IsInt()
  @Min(0)
  readonly depositAmount!: number;

  @ApiPropertyOptional({ example: 'Rách nhẹ vạt dưới, đã sửa 06/2026' })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  readonly notes?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Photo links (http/https), max 10 — no binary upload in MVP',
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
    description: 'Category id (FR-CAT-07); omit or null = unclassified',
  })
  @IsOptional() // skips null too: null IS the valid "unclassified" value
  @IsUUID()
  readonly categoryId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description:
      'What the shop paid (VND, FR-CAT-05). OWNER-ONLY: a staff request carrying this field is refused with the named 403 outcome.',
  })
  @IsOptional() // skips null too: null = "no value"
  @IsInt()
  @Min(0)
  readonly purchasePrice?: number | null;
}
