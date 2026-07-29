import { ApiProperty } from '@nestjs/swagger';

export class DressResponseDto {
  @ApiProperty({ example: '6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a' })
  readonly id!: string;

  @ApiProperty({ example: 'VD-012' })
  readonly code!: string;

  @ApiProperty({ example: 'Váy cưới đuôi cá ren trắng' })
  readonly name!: string;

  @ApiProperty({ example: 'M', nullable: true, type: String })
  readonly sizeLabel!: string | null;

  @ApiProperty({ example: 1500000, description: 'Rental price in VND' })
  readonly rentalPrice!: number;

  @ApiProperty({ example: 3000000, description: 'Standard deposit in VND' })
  readonly depositAmount!: number;

  @ApiProperty({ enum: ['active', 'retired'], example: 'active' })
  readonly status!: 'active' | 'retired';

  @ApiProperty({ nullable: true, type: String })
  readonly notes!: string | null;

  @ApiProperty({ example: '2026-07-30T10:00:00.000Z' })
  readonly createdAt!: string;
}
