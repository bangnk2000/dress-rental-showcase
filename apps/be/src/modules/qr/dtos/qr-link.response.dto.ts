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

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Chủ tiệm',
    description:
      'Name of the staff member who created it, resolved at read time (FR-QR-03). Null when that account no longer exists.',
  })
  readonly createdByName!: string | null;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: string;

  @ApiProperty({ example: '/api/v1/qr-links/00000000-0000-4000-8000-000000000001/image.svg' })
  readonly imageUrl!: string;
}
