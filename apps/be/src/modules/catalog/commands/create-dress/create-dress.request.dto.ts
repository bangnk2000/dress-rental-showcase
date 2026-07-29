import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class CreateDressRequestDto {
  @ApiProperty({ example: 'VD-012', description: 'Unique shop code' })
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/)
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
}
