import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import {
  DRESS_REPOSITORY,
  DressRepositoryPort,
} from '../../application/ports/dress.repository.port';
import { DressAlreadyRetiredError, DressNotFoundError } from '../../domain/dress.errors';
import { RetireDressCommand } from './retire-dress.command';

export type RetireDressResult = Result<
  AggregateID,
  DressNotFoundError | DressAlreadyRetiredError
>;

/**
 * One-way for now: reactivation has no registered policy (fail-closed
 * registry), so it deliberately does not exist yet.
 */
@CommandHandler(RetireDressCommand)
export class RetireDressService implements ICommandHandler<RetireDressCommand, RetireDressResult> {
  constructor(
    @Inject(DRESS_REPOSITORY)
    private readonly dressRepo: DressRepositoryPort,
  ) {}

  async execute(command: RetireDressCommand): Promise<RetireDressResult> {
    const dress = await this.dressRepo.findOneById(command.dressId);
    if (!dress) return Err(new DressNotFoundError());

    const retired = dress.retire(new Date());
    if (retired.isErr()) return Err(retired.unwrapErr());

    await this.dressRepo.save(dress);
    return Ok(dress.id);
  }
}
