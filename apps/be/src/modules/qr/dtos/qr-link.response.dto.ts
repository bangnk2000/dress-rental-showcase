import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QrLinkResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'https://example.com/lookbook' })
  readonly targetUrl!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Lookbook August' })
  readonly label!: string | null;

  @ApiProperty({ format: 'uuid' })
  readonly createdByStaffId!: string;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: string;

  @ApiProperty({ example: '/api/v1/qr-links/00000000-0000-4000-8000-000000000001/image.svg' })
  readonly imageUrl!: string;
}
