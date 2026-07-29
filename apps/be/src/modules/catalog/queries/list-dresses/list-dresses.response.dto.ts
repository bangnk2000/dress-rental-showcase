import { ApiProperty } from '@nestjs/swagger';
import { DressResponseDto } from '../../dtos/dress.response.dto';

export class DressListResponseDto {
  @ApiProperty({ type: [DressResponseDto] })
  readonly data!: DressResponseDto[];

  @ApiProperty({ example: 200 })
  readonly count!: number;

  @ApiProperty({ example: 20 })
  readonly limit!: number;

  @ApiProperty({ example: 1 })
  readonly page!: number;
}
