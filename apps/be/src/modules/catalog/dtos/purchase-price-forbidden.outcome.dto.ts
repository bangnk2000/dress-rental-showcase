import { ApiProperty } from '@nestjs/swagger';

/**
 * Named 403 OUTCOME of create/update-dress (ADR 0001 §3): a staff request carried the
 * owner-only purchasePrice field. Same family as the late-fee waiver denial — the use case ran
 * and refused; this is not the guard envelope.
 */
export class PurchasePriceForbiddenOutcomeDto {
  @ApiProperty({ enum: ['forbidden'] })
  readonly status!: 'forbidden';

  @ApiProperty({ enum: ['purchase_price_owner_only'] })
  readonly reason!: 'purchase_price_owner_only';
}
