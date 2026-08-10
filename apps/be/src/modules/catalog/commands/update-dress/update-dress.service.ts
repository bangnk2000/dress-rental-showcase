import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { Money } from '../../../../libs/ddd/money.value-object';
import { DressCodeConflictError } from '../../application/ports/dress-code-conflict.error';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '../../application/ports/category.repository.port';
import {
  DRESS_REPOSITORY,
  DressRepositoryPort,
} from '../../application/ports/dress.repository.port';
import { DressCode } from '../../domain/dress-code.value-object';
import { CategoryNotFoundError } from '../../domain/category.errors';
import { DressCodeAlreadyExistsError, DressNotFoundError } from '../../domain/dress.errors';
import { UpdateDressCommand } from './update-dress.command';

export type UpdateDressResult = Result<
  AggregateID,
  DressNotFoundError | DressCodeAlreadyExistsError | CategoryNotFoundError
>;

@CommandHandler(UpdateDressCommand)
export class UpdateDressService implements ICommandHandler<UpdateDressCommand, UpdateDressResult> {
  constructor(
    @Inject(DRESS_REPOSITORY)
    private readonly dressRepo: DressRepositoryPort,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepo: CategoryRepositoryPort,
  ) {}

  async execute(command: UpdateDressCommand): Promise<UpdateDressResult> {
    const dress = await this.dressRepo.findOneById(command.dressId);
    if (!dress) return Err(new DressNotFoundError());

    // A NEW assignment must point at a category that still exists (null clears, no check).
    if (command.categoryId !== undefined && command.categoryId !== null) {
      const category = await this.categoryRepo.findOneById(command.categoryId);
      if (!category) return Err(new CategoryNotFoundError());
    }

    const now = new Date();
    const props = dress.getProps();

    if (command.code !== undefined) {
      const nextCode = DressCode.create(command.code);
      if (nextCode.unpack() !== props.code.unpack()) {
        // Uniqueness precondition; the DB unique constraint backs it against races.
        const taken = await this.dressRepo.findOneByCode(nextCode.unpack());
        if (taken) return Err(new DressCodeAlreadyExistsError(nextCode.unpack()));
        dress.changeCode(nextCode, now);
      }
    }

    // undefined = keep; explicit null clears the nullable fields.
    dress.updateDetails(
      {
        name: command.name ?? props.name,
        sizeLabel: command.sizeLabel === undefined ? props.sizeLabel : command.sizeLabel,
        rentalPrice:
          command.rentalPrice === undefined ? props.rentalPrice : Money.create(command.rentalPrice),
        depositAmount:
          command.depositAmount === undefined
            ? props.depositAmount
            : Money.create(command.depositAmount),
        notes: command.notes === undefined ? props.notes : command.notes,
        photoUrls: command.photoUrls === undefined ? props.photoUrls : command.photoUrls,
        categoryId: command.categoryId === undefined ? props.categoryId : command.categoryId,
      },
      now,
    );

    try {
      await this.dressRepo.save(dress);
    } catch (error) {
      if (error instanceof DressCodeConflictError) {
        // A concurrent write took the new code after the pre-check above — same rule, same
        // outcome as that check would have produced (ADR 0001 §2).
        return Err(new DressCodeAlreadyExistsError(dress.getProps().code.unpack(), error));
      }
      throw error;
    }
    return Ok(dress.id);
  }
}
