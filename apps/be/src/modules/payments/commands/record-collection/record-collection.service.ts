import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { Money } from '../../../../libs/ddd/money.value-object';
import {
  CollectionConflictError,
  RentalNotOpenError,
} from '../../application/ports/collection-conflict.error';
import {
  PAYMENT_REPOSITORY,
  PaymentRepositoryPort,
  RecordedCollection,
} from '../../application/ports/payment.repository.port';
import {
  RENTAL_LOOKUP,
  RentalLookupPort,
} from '../../application/ports/rental-lookup.port';
import { PaymentEntity } from '../../domain/payment.entity';
import {
  CollectionAlreadyRecordedError,
  CollectionRentalNotFoundError,
  NothingToRecordError,
  RentalClosedError,
} from '../../domain/payment.errors';
import { CollectionKind } from '../../domain/payment.types';
import { RecordCollectionCommand } from './record-collection.command';

export type RecordCollectionResult = Result<
  AggregateID,
  | CollectionRentalNotFoundError
  | RentalClosedError
  | NothingToRecordError
  | CollectionAlreadyRecordedError
>;

@CommandHandler(RecordCollectionCommand)
export class RecordCollectionService
  implements ICommandHandler<RecordCollectionCommand, RecordCollectionResult>
{
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepo: PaymentRepositoryPort,
    @Inject(RENTAL_LOOKUP)
    private readonly rentalLookup: RentalLookupPort,
  ) {}

  /**
   * FR-PAY-02 (docs/design/payments/record-collection.md): writes down money that has ALREADY
   * changed hands. It never touches the rental — recording cash is not a lifecycle event.
   */
  async execute(command: RecordCollectionCommand): Promise<RecordCollectionResult> {
    const status = await this.rentalLookup.findStatus(command.rentalId);
    if (!status) return Err(new CollectionRentalNotFoundError());
    if (status === 'returned' || status === 'cancelled') {
      return Err(new RentalClosedError(status));
    }

    const requested: Array<{ kind: CollectionKind; amount: number }> = [
      { kind: 'deposit' as const, amount: command.deposit ?? 0 },
      { kind: 'rental_fee' as const, amount: command.rentalFee ?? 0 },
    ].filter((entry) => entry.amount > 0);
    if (requested.length === 0) return Err(new NothingToRecordError());

    // R3 pre-check. The partial UNIQUE index backs it against races — see the catch below.
    const alreadyRecorded = await this.paymentRepo.findCollected(command.rentalId);
    const clash = this.firstClash(requested, alreadyRecorded);
    if (clash) return Err(clash);

    const now = new Date();
    const payments = requested.map((entry) =>
      PaymentEntity.record(
        {
          rentalId: command.rentalId,
          kind: entry.kind,
          amount: Money.create(entry.amount),
          note: command.note,
        },
        this.paymentRepo.nextId(),
        now,
      ),
    );

    try {
      await this.paymentRepo.recordCollection(command.rentalId, payments);
    } catch (error) {
      if (error instanceof CollectionConflictError) {
        // A concurrent request recorded first and the index refused this write. Same business rule
        // as the pre-check above, so it MUST be the same outcome (ADR 0001 §2) — re-read so the
        // payload states the amount that is actually on file now.
        const recordedNow = await this.paymentRepo.findCollected(command.rentalId);
        return Err(
          this.firstClash(requested, recordedNow) ??
            new CollectionAlreadyRecordedError(requested[0]!.kind, 0, error),
        );
      }
      if (error instanceof RentalNotOpenError) {
        // The rental closed between the pre-check above and the locked write. Same rule again, so
        // the caller must not be able to tell which of the two noticed (R4).
        return Err(
          error.currentStatus === null
            ? new CollectionRentalNotFoundError(error)
            : new RentalClosedError(error.currentStatus, error),
        );
      }
      throw error;
    }

    // 1..2 rows were written, so there is no single movement id to hand back: the rental is what
    // the caller asked about and what it will re-read.
    return Ok(command.rentalId);
  }

  private firstClash(
    requested: ReadonlyArray<{ kind: CollectionKind; amount: number }>,
    recorded: ReadonlyArray<RecordedCollection>,
  ): CollectionAlreadyRecordedError | null {
    for (const entry of requested) {
      const existing = recorded.find((row) => row.kind === entry.kind);
      if (existing) {
        return new CollectionAlreadyRecordedError(entry.kind, existing.amount);
      }
    }
    return null;
  }
}
