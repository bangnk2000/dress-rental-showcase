import { AggregateID } from '../../../../libs/ddd/entity.base';
import { PaymentEntity } from '../../domain/payment.entity';
import { CollectionKind } from '../../domain/payment.types';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

/** What is already on file for a rental, per collected kind. */
export interface RecordedCollection {
  kind: CollectionKind;
  amount: number;
}

export interface PaymentRepositoryPort {
  nextId(): AggregateID;

  /** The `deposit` / `rental_fee` rows a rental already holds (R3 pre-check). */
  findCollected(rentalId: string): Promise<RecordedCollection[]>;

  /**
   * Writes 1..2 movements in ONE transaction (R5). Throws `CollectionConflictError` when the
   * partial UNIQUE index refuses a row — a race the pre-check could not see.
   */
  recordCollection(payments: PaymentEntity[]): Promise<void>;
}
