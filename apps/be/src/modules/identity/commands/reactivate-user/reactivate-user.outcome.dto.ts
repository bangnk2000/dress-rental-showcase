import { ApiProperty } from '@nestjs/swagger';

/** Business rejections of identity/reactivate-user (422) — ADR 0001 §3. */
export class ReactivateUserOutcomeDto {
  @ApiProperty({ enum: ['rejected_user_not_found', 'rejected_user_already_active'] })
  readonly status!: 'rejected_user_not_found' | 'rejected_user_already_active';
}
