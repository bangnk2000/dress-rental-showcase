import { ApiProperty } from '@nestjs/swagger';

/**
 * Business rejections of identity/login (422) — ADR 0001 §3. Wrong credentials are a RESULT of
 * the use case, not a transport fault: 401 is reserved for the guard rejecting an access token,
 * which is what lets the FE run refresh-and-retry without guessing what a 401 means.
 * `rejected_account_locked` is only reachable with a CORRECT password (identity/manage-users
 * spec §6.Q4) — credentials stay unprobeable.
 */
export class LoginOutcomeDto {
  @ApiProperty({ enum: ['rejected_invalid_credentials', 'rejected_account_locked'] })
  readonly status!: 'rejected_invalid_credentials' | 'rejected_account_locked';
}
