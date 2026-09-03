import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import {
  STAFF_USER_REPOSITORY,
  StaffUserRepositoryPort,
} from '../../application/ports/staff-user.repository.port';
import { UserAlreadyActiveError, UserNotFoundError } from '../../domain/identity.errors';
import { ReactivateUserCommand } from './reactivate-user.command';

export type ReactivateUserResult = Result<AggregateID, UserNotFoundError | UserAlreadyActiveError>;

@CommandHandler(ReactivateUserCommand)
export class ReactivateUserService
  implements ICommandHandler<ReactivateUserCommand, ReactivateUserResult>
{
  constructor(
    @Inject(STAFF_USER_REPOSITORY)
    private readonly staffRepo: StaffUserRepositoryPort,
  ) {}

  async execute(command: ReactivateUserCommand): Promise<ReactivateUserResult> {
    const user = await this.staffRepo.findOneById(command.userId);
    if (!user) return Err(new UserNotFoundError());

    const reactivated = user.reactivate(new Date());
    if (reactivated.isErr()) return Err(reactivated.unwrapErr());

    await this.staffRepo.save(user);
    return Ok(user.id);
  }
}
