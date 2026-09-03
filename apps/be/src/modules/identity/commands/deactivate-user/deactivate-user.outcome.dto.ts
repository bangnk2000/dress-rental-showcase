import { ApiProperty } from '@nestjs/swagger';

/** Business rejections of identity/deactivate-user (422) — ADR 0001 §3. */
export class DeactivateUserOutcomeDto {
  @ApiProperty({
    enum: ['rejected_user_not_found', 'rejected_user_already_inactive', 'rejected_cannot_deactivate_self'],
  })
  readonly status!:
    | 'rejected_user_not_found'
    | 'rejected_user_already_inactive'
    | 'rejected_cannot_deactivate_self';
}
