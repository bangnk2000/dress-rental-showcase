import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, ValidateNested } from 'class-validator';

export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

/** R4 — a dress holds at most 10 photos, so one submit never needs more URLs than that. */
export const MAX_PHOTO_UPLOADS_PER_REQUEST = 10;

export class PhotoUploadFileDto {
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

export class CreatePhotoUploadUrlsRequestDto {
  @ApiProperty({
    type: [PhotoUploadFileDto],
    minItems: 1,
    maxItems: MAX_PHOTO_UPLOADS_PER_REQUEST,
    description: 'One entry per photo to upload; the response lists the URLs in the same order',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PHOTO_UPLOADS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => PhotoUploadFileDto)
  readonly files!: PhotoUploadFileDto[];
}
