import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { hash } from 'bcryptjs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import {
  STAFF_USER_REPOSITORY,
  StaffUserRepositoryPort,
} from '../../application/ports/staff-user.repository.port';
import { UsernameConflictError } from '../../application/ports/username-conflict.error';
import { StaffUserEntity } from '../../domain/staff-user.entity';
import { UsernameAlreadyExistsError } from '../../domain/identity.errors';
import { Username } from '../../domain/username.value-object';
import { CreateUserCommand } from './create-user.command';

export type CreateUserResult = Result<AggregateID, UsernameAlreadyExistsError>;

/**
 * Creates STAFF accounts only (spec §6.Q3): the single owner comes from the seed, and a second
 * owner is a one-line change when the shop actually asks for it.
 */
@CommandHandler(CreateUserCommand)
export class CreateUserService implements ICommandHandler<CreateUserCommand, CreateUserResult> {
  constructor(
    @Inject(STAFF_USER_REPOSITORY)
    private readonly staffRepo: StaffUserRepositoryPort,
  ) {}

  async execute(command: CreateUserCommand): Promise<CreateUserResult> {
    const username = Username.create(command.username);

    // Uniqueness precondition; the lower(username) UNIQUE index backs it against races.
    const existing = await this.staffRepo.findOneByUsername(username.unpack());
    if (existing) return Err(new UsernameAlreadyExistsError(username.unpack()));

    const user = StaffUserEntity.create(
      {
        username: username.unpack(),
        name: command.name,
        role: 'staff',
        passwordHash: await hash(command.password, 10),
      },
      this.staffRepo.nextId(),
      new Date(),
    );

    try {
      await this.staffRepo.insert(user);
    } catch (error) {
      if (error instanceof UsernameConflictError) {
        // A concurrent request took the username after the pre-check: same rule, same outcome.
        return Err(new UsernameAlreadyExistsError(username.unpack(), error));
      }
      throw error;
    }
    return Ok(user.id);
  }
}
