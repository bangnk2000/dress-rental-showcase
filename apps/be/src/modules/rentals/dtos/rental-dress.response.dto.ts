import { ApiProperty } from '@nestjs/swagger';

/** A dress inside a rental, as reads display it — shared by board and list. */
export class RentalDressDto {
  @ApiProperty({ format: 'uuid' })
  readonly dressId!: string;

  @ApiProperty({ example: 'VD-001' })
  readonly code!: string;

  @ApiProperty({ example: 'Váy cưới ren trắng' })
  readonly name!: string;

  @ApiProperty({
    example: 3_000_000,
    description:
      'The catalog STANDARD deposit for this dress in VND — a reference figure. What was actually collected is the `deposit` total of GET /rentals/:id/payments (FR-PAY-02)',
  })
  readonly depositAmount!: number;

  @ApiProperty({
    example: 1_500_000,
    description:
      'The price agreed with THIS customer for this dress in VND (rental_items.price), which may differ from the catalog price',
  })
  readonly agreedPrice!: number;
}
