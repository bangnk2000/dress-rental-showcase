import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import {
  STAFF_USER_REPOSITORY,
  StaffUserRepositoryPort,
} from '../../application/ports/staff-user.repository.port';
import {
  CannotDeactivateSelfError,
  UserAlreadyInactiveError,
  UserNotFoundError,
} from '../../domain/identity.errors';
import { DeactivateUserCommand } from './deactivate-user.command';

export type DeactivateUserResult = Result<
  AggregateID,
  UserNotFoundError | UserAlreadyInactiveError | CannotDeactivateSelfError
>;

@CommandHandler(DeactivateUserCommand)
export class DeactivateUserService
  implements ICommandHandler<DeactivateUserCommand, DeactivateUserResult>
{
  constructor(
    @Inject(STAFF_USER_REPOSITORY)
    private readonly staffRepo: StaffUserRepositoryPort,
  ) {}

  async execute(command: DeactivateUserCommand): Promise<DeactivateUserResult> {
    // The rule guards the ACTOR's own account, whatever its role: the last person able to
    // manage accounts must never be able to lock themselves out.
    if (command.userId === command.actorId) return Err(new CannotDeactivateSelfError());

    const user = await this.staffRepo.findOneById(command.userId);
    if (!user) return Err(new UserNotFoundError());

    const deactivated = user.deactivate(new Date());
    if (deactivated.isErr()) return Err(deactivated.unwrapErr());

    await this.staffRepo.save(user);
    return Ok(user.id);
  }
}
