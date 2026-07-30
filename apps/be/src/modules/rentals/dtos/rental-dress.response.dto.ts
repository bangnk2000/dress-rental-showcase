import { ApiProperty } from '@nestjs/swagger';

/** A dress inside a rental, as reads display it — shared by board and list. */
export class RentalDressDto {
  @ApiProperty({ format: 'uuid' })
  readonly dressId!: string;

  @ApiProperty({ example: 'VD-001' })
  readonly code!: string;

  @ApiProperty({ example: 'Váy cưới ren trắng' })
  readonly name!: string;
}
