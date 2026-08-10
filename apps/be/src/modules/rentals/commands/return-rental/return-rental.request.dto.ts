import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class ReturnRentalRequestDto {
  @ApiPropertyOptional({ example: 200000, description: 'Late fee in VND (integer)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly lateFee?: number;

  @ApiPropertyOptional({ example: 500000, description: 'Damage fee in VND (integer)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly damageFee?: number;

  @ApiPropertyOptional({
    example: 3000000,
    description: 'Deposit amount handed back to the customer, in VND (integer)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly depositRefund?: number;

  @ApiPropertyOptional({
    example: 3000000,
    description:
      'The deposit total the client computed its refund from. When present the server verifies it against the ledger under the rental row lock and refuses a settlement whose basis moved (FR-PAY-02).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly expectedDepositCollected?: number;

  @ApiPropertyOptional({ example: 'Rách nhẹ đường viền, đã thoả thuận phí' })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  readonly note?: string;
}
