import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class SetListingDressesRequestDto {
  @ApiProperty({
    type: [String],
    description:
      'The COMPLETE list of dresses of this listing (replaces the current set; [] detaches all). Retired dresses may be attached — they just never show on the web.',
  })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  readonly dressIds!: string[];
}
