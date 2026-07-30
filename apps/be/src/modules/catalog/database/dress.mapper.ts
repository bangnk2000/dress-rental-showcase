import { Injectable } from '@nestjs/common';
import { Mapper } from '../../../libs/ddd/mapper.interface';
import { Money } from '../../../libs/ddd/money.value-object';
import { toDate } from '../../../libs/utils/date';
import { DressCode } from '../domain/dress-code.value-object';
import { DressEntity } from '../domain/dress.entity';
import { DressResponseDto } from '../dtos/dress.response.dto';
import { DressModel } from './dress.persistence.model';

@Injectable()
export class DressMapper implements Mapper<DressEntity, DressModel, DressResponseDto> {
  toDomain(record: DressModel): DressEntity {
    return new DressEntity({
      id: record.id,
      createdAt: toDate(record.created_at),
      updatedAt: toDate(record.updated_at),
      props: {
        code: DressCode.create(record.code),
        name: record.name,
        sizeLabel: record.size_label,
        rentalPrice: Money.create(record.rental_price),
        depositAmount: Money.create(record.deposit_amount),
        status: record.status,
        notes: record.notes,
        photoUrls: [...record.photo_urls],
      },
    });
  }

  toPersistence(entity: DressEntity): DressModel {
    const props = entity.getProps();
    return {
      id: props.id,
      code: props.code.unpack(),
      name: props.name,
      size_label: props.sizeLabel,
      rental_price: props.rentalPrice.amount,
      deposit_amount: props.depositAmount.amount,
      status: props.status,
      notes: props.notes,
      photo_urls: [...props.photoUrls],
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    };
  }

  toResponse(entity: DressEntity): DressResponseDto {
    const props = entity.getProps();
    return Object.assign(new DressResponseDto(), {
      id: props.id,
      code: props.code.unpack(),
      name: props.name,
      sizeLabel: props.sizeLabel,
      rentalPrice: props.rentalPrice.amount,
      depositAmount: props.depositAmount.amount,
      status: props.status,
      notes: props.notes,
      photoUrls: [...props.photoUrls],
      createdAt: props.createdAt.toISOString(),
    });
  }
}
