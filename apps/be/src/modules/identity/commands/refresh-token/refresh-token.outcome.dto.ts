import { ApiProperty } from '@nestjs/swagger';

/**
 * Business rejection of identity/refresh-token (422) — ADR 0001 §3. Terminal for the client: the
 * mutator clears the session instead of retrying.
 */
export class RefreshTokenOutcomeDto {
  @ApiProperty({ enum: ['rejected_invalid_refresh_token'] })
  readonly status!: 'rejected_invalid_refresh_token';
}
