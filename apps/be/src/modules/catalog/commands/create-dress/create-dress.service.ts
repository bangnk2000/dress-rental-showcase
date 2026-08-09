import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { Money } from '../../../../libs/ddd/money.value-object';
import { DressCode } from '../../domain/dress-code.value-object';
import { DressEntity } from '../../domain/dress.entity';
import { DressCodeAlreadyExistsError } from '../../domain/dress.errors';
import { DressCodeConflictError } from '../../application/ports/dress-code-conflict.error';
import {
  DRESS_REPOSITORY,
  DressRepositoryPort,
} from '../../application/ports/dress.repository.port';
import { CreateDressCommand } from './create-dress.command';

export type CreateDressResult = Result<AggregateID, DressCodeAlreadyExistsError>;

@CommandHandler(CreateDressCommand)
export class CreateDressService implements ICommandHandler<CreateDressCommand, CreateDressResult> {
  constructor(
    @Inject(DRESS_REPOSITORY)
    private readonly dressRepo: DressRepositoryPort,
  ) {}

  async execute(command: CreateDressCommand): Promise<CreateDressResult> {
    const code = DressCode.create(command.code);

    // Uniqueness precondition; the DB unique constraint backs it against races.
    const existing = await this.dressRepo.findOneByCode(code.unpack());
    if (existing) return Err(new DressCodeAlreadyExistsError(code.unpack()));

    const dress = DressEntity.create(
      {
        code,
        name: command.name,
        sizeLabel: command.sizeLabel,
        rentalPrice: Money.create(command.rentalPrice),
        depositAmount: Money.create(command.depositAmount),
        notes: command.notes,
        photoUrls: command.photoUrls,
      },
      this.dressRepo.nextId(),
      new Date(),
    );

    try {
      await this.dressRepo.insert(dress);
    } catch (error) {
      if (error instanceof DressCodeConflictError) {
        // A concurrent request took the code after the pre-check above. Same business rule, so it
        // MUST be the same outcome (ADR 0001 §2) rather than a generic conflict envelope.
        return Err(new DressCodeAlreadyExistsError(code.unpack(), error));
      }
      throw error;
    }
    return Ok(dress.id);
  }
}
