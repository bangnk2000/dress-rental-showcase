import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

export class CreatePhotoUploadUrlRequestDto {
  /*
   * Deliberately only @IsString(), not @IsIn(): an @IsIn failure would surface as the generic
   * GENERIC.VALIDATION envelope, but the spec promises the FE the distinct PHOTO.UNSUPPORTED_TYPE
   * code — the whitelist is checked in the service. The swagger enum still types the clients.
   */
  @ApiProperty({ enum: PHOTO_CONTENT_TYPES, example: 'image/jpeg' })
  @IsString()
  readonly contentType!: PhotoContentType;

  @ApiProperty({
    type: 'integer',
    example: 2_097_152,
    description: 'Exact file size in bytes; signed into the URL, so the PUT body must match it',
  })
  @IsInt()
  readonly contentLength!: number;
}
