import { ApiProperty } from '@nestjs/swagger';

/** Business rejection of identity/reset-password (422) — ADR 0001 §3. */
export class ResetPasswordOutcomeDto {
  @ApiProperty({ enum: ['rejected_user_not_found'] })
  readonly status!: 'rejected_user_not_found';
}
