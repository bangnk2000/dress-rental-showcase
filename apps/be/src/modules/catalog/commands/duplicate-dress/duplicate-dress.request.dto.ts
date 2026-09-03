import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

/** Everything else is copied from the source dress; the code is assigned by the server. */
export class DuplicateDressRequestDto {
  @ApiPropertyOptional({
    example: 'L',
    nullable: true,
    type: String,
    description:
      'Size of the copy (FR-CAT-08). Omit = same size as the source; null = the copy has no size.',
  })
  @IsOptional() // skips null too: null IS the valid "no size" value
  @IsString()
  @Length(1, 20)
  readonly sizeLabel?: string | null;
}
