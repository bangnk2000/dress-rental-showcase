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
      'The catalog STANDARD deposit for this dress in VND — a reference, not what was collected: no deposit is recorded at booking time',
  })
  readonly depositAmount!: number;
}
