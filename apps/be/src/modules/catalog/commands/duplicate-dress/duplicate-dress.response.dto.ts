import { ApiProperty } from '@nestjs/swagger';

/** The copy's identity: the id to navigate to and the code the server assigned. */
export class DuplicateDressResponseDto {
  @ApiProperty({ example: '6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a' })
  readonly id!: string;

  @ApiProperty({ example: 'VD-012_1', description: 'Assigned code: <base>_<n>, n from 1' })
  readonly code!: string;
}
