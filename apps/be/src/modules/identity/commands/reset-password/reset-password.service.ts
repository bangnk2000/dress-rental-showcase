import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { hash } from 'bcryptjs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import {
  STAFF_USER_REPOSITORY,
  StaffUserRepositoryPort,
} from '../../application/ports/staff-user.repository.port';
import { UserNotFoundError } from '../../domain/identity.errors';
import { ResetPasswordCommand } from './reset-password.command';

export type ResetPasswordResult = Result<AggregateID, UserNotFoundError>;

/**
 * Owner-set password (no email infra — the counter is the channel). A LOCKED user can still get
 * a new password: setting one is preparation for the unlock, not an action of that user.
 */
@CommandHandler(ResetPasswordCommand)
export class ResetPasswordService
  implements ICommandHandler<ResetPasswordCommand, ResetPasswordResult>
{
  constructor(
    @Inject(STAFF_USER_REPOSITORY)
    private readonly staffRepo: StaffUserRepositoryPort,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<ResetPasswordResult> {
    const user = await this.staffRepo.findOneById(command.userId);
    if (!user) return Err(new UserNotFoundError());

    user.resetPassword(await hash(command.newPassword, 10), new Date());
    await this.staffRepo.save(user);
    return Ok(user.id);
  }
}
