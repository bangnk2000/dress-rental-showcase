import { ApiProperty } from '@nestjs/swagger';

/** Business rejection of identity/create-user (422) — ADR 0001 §3. */
export class CreateUserOutcomeDto {
  @ApiProperty({ enum: ['rejected_username_taken'] })
  readonly status!: 'rejected_username_taken';

  @ApiProperty({
    example: 'lan',
    description: 'The normalized (lowercased) username that is already taken',
  })
  readonly username!: string;
}
