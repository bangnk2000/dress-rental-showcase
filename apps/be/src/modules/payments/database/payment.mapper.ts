import { Injectable } from '@nestjs/common';
import { Mapper } from '../../../libs/ddd/mapper.interface';
import { Money } from '../../../libs/ddd/money.value-object';
import { toDate } from '../../../libs/utils/date';
import { PaymentEntity } from '../domain/payment.entity';
import { PaymentKind } from '../domain/payment.types';
import { PaymentModel } from './payment.persistence.model';

/**
 * Entity → plain movement. The HTTP read side does NOT go through here: `list-payments` projects
 * rows straight from SQL (CQRS), so this exists for the Mapper contract and for tests that assert
 * what was written.
 */
export interface PaymentSnapshot {
  id: string;
  rentalId: string;
  kind: PaymentKind;
  amount: number;
  note: string | null;
  createdAt: string;
}

@Injectable()
export class PaymentMapper implements Mapper<PaymentEntity, PaymentModel, PaymentSnapshot> {
  toDomain(record: PaymentModel): PaymentEntity {
    const createdAt = toDate(record.created_at);
    return new PaymentEntity({
      id: record.id,
      createdAt,
      // A movement is never edited, so its "last change" IS its creation (no updated_at column).
      updatedAt: createdAt,
      props: {
        rentalId: record.rental_id,
        kind: record.kind,
        amount: Money.create(record.amount),
        note: record.note,
      },
    });
  }

  toPersistence(entity: PaymentEntity): PaymentModel {
    const props = entity.getProps();
    return {
      id: props.id,
      rental_id: props.rentalId,
      kind: props.kind,
      amount: props.amount.amount,
      note: props.note,
      created_at: props.createdAt,
    };
  }

  toResponse(entity: PaymentEntity): PaymentSnapshot {
    const props = entity.getProps();
    return {
      id: props.id,
      rentalId: props.rentalId,
      kind: props.kind,
      amount: props.amount.amount,
      note: props.note,
      createdAt: props.createdAt.toISOString(),
    };
  }
}
