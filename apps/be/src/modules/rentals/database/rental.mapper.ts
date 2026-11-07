import { Injectable } from '@nestjs/common';
import { Mapper } from '../../../libs/ddd/mapper.interface';
import { Money } from '../../../libs/ddd/money.value-object';
import { toDate } from '../../../libs/utils/date';
import { RentalEntity } from '../domain/rental.entity';
import { RentalItemEntity } from '../domain/rental-item.entity';
import { RentalPeriod } from '../domain/rental-period.value-object';
import { RentalStatus } from '../domain/rental.types';
import { fromDateRangeLiteral, toDateRangeLiteral } from './daterange';
import { RentalModel } from './rental.persistence.model';

/** Plain read snapshot — no HTTP endpoint returns it yet (queries project straight from SQL). */
export interface RentalSnapshot {
  id: string;
  customerName: string;
  customerPhone: string;
  startDate: string;
  endDate: string;
  status: RentalStatus;
  notes: string | null;
  discountAmount: number;
  items: { dressId: string; price: number }[];
  createdAt: string;
}

@Injectable()
export class RentalMapper implements Mapper<RentalEntity, RentalModel, RentalSnapshot> {
  toDomain(record: RentalModel): RentalEntity {
    const period = fromDateRangeLiteral(record.rental.period);
    const createdAt = toDate(record.rental.created_at);
    return new RentalEntity({
      id: record.rental.id,
      createdAt,
      updatedAt: toDate(record.rental.updated_at),
      props: {
        customerName: record.rental.customer_name,
        customerPhone: record.rental.customer_phone,
        period: RentalPeriod.create(period.start, period.endInclusive),
        status: record.rental.status,
        notes: record.rental.notes,
        discount: Money.create(record.rental.discount_amount),
        cancelReason: record.rental.cancel_reason,
        items: record.items.map((item) => {
          const blocked = fromDateRangeLiteral(item.blocked_period);
          return new RentalItemEntity({
            id: item.id,
            createdAt,
            updatedAt: createdAt,
            props: {
              dressId: item.dress_id,
              price: Money.create(item.price),
              blockedPeriod: RentalPeriod.create(blocked.start, blocked.endInclusive),
              blocking: item.blocking,
            },
          });
        }),
      },
    });
  }

  toPersistence(entity: RentalEntity): RentalModel {
    const props = entity.getProps();
    return {
      rental: {
        id: props.id,
        customer_name: props.customerName,
        customer_phone: props.customerPhone,
        period: toDateRangeLiteral(props.period.start, props.period.end),
        status: props.status,
        notes: props.notes,
        discount_amount: props.discount.amount,
        cancel_reason: props.cancelReason ?? null,
        created_at: props.createdAt.toISOString(),
        updated_at: props.updatedAt.toISOString(),
      },
      items: props.items.map((item) => ({
        id: item.id,
        rental_id: props.id,
        dress_id: item.dressId,
        price: item.price.amount,
        blocked_period: toDateRangeLiteral(item.blockedPeriod.start, item.blockedPeriod.end),
        blocking: item.blocking,
      })),
    };
  }

  toResponse(entity: RentalEntity): RentalSnapshot {
    const props = entity.getProps();
    return {
      id: props.id,
      customerName: props.customerName,
      customerPhone: props.customerPhone,
      startDate: props.period.start,
      endDate: props.period.end,
      status: props.status,
      notes: props.notes,
      discountAmount: props.discount.amount,
      items: props.items.map((item) => ({ dressId: item.dressId, price: item.price.amount })),
      createdAt: props.createdAt.toISOString(),
    };
  }
}
