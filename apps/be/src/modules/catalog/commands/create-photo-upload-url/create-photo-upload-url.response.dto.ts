import { ApiProperty } from '@nestjs/swagger';

/**
 * Set EXACTLY these headers on the PUT — both are part of the signature. Content-Length is signed
 * too but not listed: browsers forbid setting it and derive it from the File body, so it matches as
 * long as the uploaded file is the one whose `contentLength` was declared.
 */
export class PhotoUploadHeadersDto {
  @ApiProperty({ name: 'Content-Type', example: 'image/jpeg' })
  readonly 'Content-Type'!: string;

  @ApiProperty({ name: 'Cache-Control', example: 'public, max-age=31536000, immutable' })
  readonly 'Cache-Control'!: string;
}

export class PhotoUploadUrlDto {
  @ApiProperty({ description: 'Presigned R2 PUT URL, valid for 300 s, for exactly one key' })
  readonly uploadUrl!: string;

  @ApiProperty({ enum: ['PUT'] })
  readonly method!: 'PUT';

  @ApiProperty({ type: PhotoUploadHeadersDto })
  readonly headers!: PhotoUploadHeadersDto;

  @ApiProperty({
    example: 'https://img.example.com/photos/2026/09/6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a.jpg',
    description: 'Public URL of the photo once the PUT succeeds — append it to the dress photoUrls',
  })
  readonly url!: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-25T10:05:00.000Z' })
  readonly expiresAt!: string;
}

export class CreatePhotoUploadUrlsResponseDto {
  @ApiProperty({
    type: [PhotoUploadUrlDto],
    description: 'One upload per requested file, in the order of `files`',
  })
  readonly uploads!: PhotoUploadUrlDto[];
}
