import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { Money } from '../../../../libs/ddd/money.value-object';
import { DressCode } from '../../domain/dress-code.value-object';
import { DressEntity } from '../../domain/dress.entity';
import { CategoryNotFoundError } from '../../domain/category.errors';
import {
  DressCodeAlreadyExistsError,
  PurchasePriceOwnerOnlyError,
} from '../../domain/dress.errors';
import { DressCodeConflictError } from '../../application/ports/dress-code-conflict.error';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '../../application/ports/category.repository.port';
import {
  DRESS_REPOSITORY,
  DressRepositoryPort,
} from '../../application/ports/dress.repository.port';
import { CreateDressCommand } from './create-dress.command';

export type CreateDressResult = Result<
  AggregateID,
  DressCodeAlreadyExistsError | CategoryNotFoundError | PurchasePriceOwnerOnlyError
>;

@CommandHandler(CreateDressCommand)
export class CreateDressService implements ICommandHandler<CreateDressCommand, CreateDressResult> {
  constructor(
    @Inject(DRESS_REPOSITORY)
    private readonly dressRepo: DressRepositoryPort,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepo: CategoryRepositoryPort,
  ) {}

  async execute(command: CreateDressCommand): Promise<CreateDressResult> {
    // FR-CAT-05 R1: the purchase price is the owner's field. Refused BY NAME, never silently
    // dropped — dropping would tell the UI "saved" about a value that was not.
    if (command.purchasePrice !== null && command.actorRole !== 'owner') {
      return Err(new PurchasePriceOwnerOnlyError());
    }

    const code = DressCode.create(command.code);

    // Uniqueness precondition; the DB unique constraint backs it against races.
    const existing = await this.dressRepo.findOneByCode(code.unpack());
    if (existing) return Err(new DressCodeAlreadyExistsError(code.unpack()));

    // Someone may have deleted the category while the form was open (FR-CAT-07); the FK is the
    // last net, this check is the named answer.
    if (command.categoryId !== null) {
      const category = await this.categoryRepo.findOneById(command.categoryId);
      if (!category) return Err(new CategoryNotFoundError());
    }

    const dress = DressEntity.create(
      {
        code,
        name: command.name,
        sizeLabel: command.sizeLabel,
        rentalPrice: Money.create(command.rentalPrice),
        depositAmount: Money.create(command.depositAmount),
        notes: command.notes,
        photoUrls: command.photoUrls,
        categoryId: command.categoryId,
        purchasePrice:
          command.purchasePrice === null ? null : Money.create(command.purchasePrice),
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
