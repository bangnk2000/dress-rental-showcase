import { ApiProperty } from '@nestjs/swagger';
import { QrLinkResponseDto } from '../../dtos/qr-link.response.dto';

export class QrLinkListResponseDto {
  @ApiProperty({ type: [QrLinkResponseDto] })
  readonly data!: QrLinkResponseDto[];

  @ApiProperty({ example: 200 })
  readonly count!: number;

  @ApiProperty({ example: 20 })
  readonly limit!: number;

  @ApiProperty({ example: 1 })
  readonly page!: number;
}
