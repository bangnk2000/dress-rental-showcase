import { ApiProperty } from '@nestjs/swagger';

/**
 * What the return dialog needs to state the late fee BEFORE staff confirms (FR-RENT-09 §4).
 * Explicit fields only — the aggregate never crosses the boundary.
 */
export class LateFeeQuoteResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly rentalId!: string;

  @ApiProperty({ example: '2026-08-07', description: 'Last rental day (inclusive)' })
  readonly dueDate!: string;

  @ApiProperty({ example: '2026-08-10', description: "The shop's calendar day used for the quote" })
  readonly referenceDate!: string;

  @ApiProperty({ example: 3, description: 'Calendar days after dueDate; 0 when on time' })
  readonly daysLate!: number;

  @ApiProperty({ example: 2, description: 'Dresses in the rental — the fee is per dress' })
  readonly dressCount!: number;

  @ApiProperty({ example: 200_000, description: 'VND per dress per day (shop configuration)' })
  readonly dailyRateAmount!: number;

  @ApiProperty({ example: 1_200_000, description: 'daysLate × dressCount × dailyRateAmount' })
  readonly suggestedLateFee!: number;
}
