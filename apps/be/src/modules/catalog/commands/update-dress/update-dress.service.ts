import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { Money } from '../../../../libs/ddd/money.value-object';
import {
  DRESS_REPOSITORY,
  DressRepositoryPort,
} from '../../application/ports/dress.repository.port';
import { DressCode } from '../../domain/dress-code.value-object';
import { DressCodeAlreadyExistsError, DressNotFoundError } from '../../domain/dress.errors';
import { UpdateDressCommand } from './update-dress.command';

export type UpdateDressResult = Result<
  AggregateID,
  DressNotFoundError | DressCodeAlreadyExistsError
>;

@CommandHandler(UpdateDressCommand)
export class UpdateDressService implements ICommandHandler<UpdateDressCommand, UpdateDressResult> {
  constructor(
    @Inject(DRESS_REPOSITORY)
    private readonly dressRepo: DressRepositoryPort,
  ) {}

  async execute(command: UpdateDressCommand): Promise<UpdateDressResult> {
    const dress = await this.dressRepo.findOneById(command.dressId);
    if (!dress) return Err(new DressNotFoundError());

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
      },
      now,
    );

    await this.dressRepo.save(dress);
    return Ok(dress.id);
  }
}
