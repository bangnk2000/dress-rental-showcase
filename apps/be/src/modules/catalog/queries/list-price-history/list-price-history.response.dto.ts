import { ApiProperty } from '@nestjs/swagger';

export class PriceHistoryChangedByDto {
  @ApiProperty({ example: '6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a' })
  readonly id!: string;

  @ApiProperty({ example: 'Chị Lan', description: 'Display name of the staff who changed it' })
  readonly name!: string;
}

export class PriceHistoryEntryDto {
  @ApiProperty({ example: 1500000 })
  readonly rentalPrice!: number;

  @ApiProperty({ example: 3000000 })
  readonly depositAmount!: number;

  @ApiProperty({ example: '2026-08-10T03:00:00.000Z' })
  readonly changedAt!: string;

  @ApiProperty({
    nullable: true,
    type: PriceHistoryChangedByDto,
    description: 'null = the row predates the log (backfill) or came from the seed import',
  })
  readonly changedBy!: PriceHistoryChangedByDto | null;
}

export class PriceHistoryListResponseDto {
  @ApiProperty({ type: [PriceHistoryEntryDto], description: 'Newest first; ≥1 row per dress' })
  readonly data!: PriceHistoryEntryDto[];
}
