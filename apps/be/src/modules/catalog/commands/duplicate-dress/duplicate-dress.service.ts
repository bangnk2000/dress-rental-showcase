import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { DressCodeConflictError } from '../../application/ports/dress-code-conflict.error';
import {
  DRESS_REPOSITORY,
  DressRepositoryPort,
} from '../../application/ports/dress.repository.port';
import { DressCode } from '../../domain/dress-code.value-object';
import { DressEntity } from '../../domain/dress.entity';
import { DressCodeAlreadyExistsError, DressNotFoundError } from '../../domain/dress.errors';
import { DuplicateDressCommand } from './duplicate-dress.command';

export interface DuplicatedDress {
  id: string;
  code: string;
}

export type DuplicateDressResult = Result<
  DuplicatedDress,
  DressNotFoundError | DressCodeAlreadyExistsError
>;

/**
 * Two staff duplicating the same dress at once both compute the same `_n`; the UNIQUE index
 * refuses the loser, who simply recounts. Three tries covers any realistic number of tablets.
 */
const NUMBERING_ATTEMPTS = 3;

@CommandHandler(DuplicateDressCommand)
export class DuplicateDressService
  implements ICommandHandler<DuplicateDressCommand, DuplicateDressResult>
{
  constructor(
    @Inject(DRESS_REPOSITORY)
    private readonly dressRepo: DressRepositoryPort,
  ) {}

  async execute(command: DuplicateDressCommand): Promise<DuplicateDressResult> {
    const source = await this.dressRepo.findOneById(command.sourceDressId);
    if (!source) return Err(new DressNotFoundError());

    const props = source.getProps();
    // Copying a copy numbers from the ORIGINAL: VD-012_1 → VD-012_<next>, never VD-012_1_0.
    const base = DressCode.baseOf(props.code.unpack());

    let lastConflict: DressCodeConflictError | undefined;
    let lastCode = '';
    for (let attempt = 0; attempt < NUMBERING_ATTEMPTS; attempt += 1) {
      const taken = await this.dressRepo.findCodesStartingWith(`${base}_`);
      const code = DressCode.nextDuplicateOf(base, taken);
      lastCode = code.unpack();

      const copy = DressEntity.create(
        {
          code,
          name: props.name,
          sizeLabel: command.sizeLabel === undefined ? props.sizeLabel : command.sizeLabel,
          rentalPrice: props.rentalPrice,
          depositAmount: props.depositAmount,
          notes: props.notes,
          photoUrls: [...props.photoUrls],
          categoryId: props.categoryId,
          // Same model, same cost: the owner's figure rides along. It is never SET by the caller
          // (FR-CAT-05 R1 is about a request carrying the field), and staff responses still omit it.
          purchasePrice: props.purchasePrice,
        },
        this.dressRepo.nextId(),
        new Date(),
      );

      try {
        // v1 of the copy's price log (FR-CAT-06 R1/R4) AND its listing memberships
        // (public-listing R7) ride in the SAME transaction.
        await this.dressRepo.insertDuplicateWithHistory(copy, command.actorId, source.id);
        return Ok({ id: copy.id, code: lastCode });
      } catch (error) {
        if (error instanceof DressCodeConflictError) {
          lastConflict = error; // a concurrent duplicate took this number — count again
          continue;
        }
        throw error;
      }
    }
    // Same rule as create-dress's uniqueness precondition, so the same outcome (ADR 0001 §2).
    return Err(new DressCodeAlreadyExistsError(lastCode, lastConflict));
  }
}
