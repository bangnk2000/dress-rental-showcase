import { Injectable } from '@nestjs/common';
import { Mapper } from '../../../libs/ddd/mapper.interface';
import { toDate } from '../../../libs/utils/date';
import { QrLinkEntity } from '../domain/qr-link.entity';
import { TargetUrl } from '../domain/target-url.value-object';
import { QrLinkResponseDto } from '../dtos/qr-link.response.dto';
import { QrLinkModel } from './qr-link.persistence.model';

@Injectable()
export class QrLinkMapper implements Mapper<QrLinkEntity, QrLinkModel, QrLinkResponseDto> {
  toDomain(record: QrLinkModel): QrLinkEntity {
    return new QrLinkEntity({
      id: record.id,
      createdAt: toDate(record.created_at),
      updatedAt: toDate(record.updated_at),
      props: {
        targetUrl: TargetUrl.create(record.target_url),
        label: record.label,
        createdByStaffId: record.created_by_staff_id,
      },
    });
  }

  toPersistence(entity: QrLinkEntity): QrLinkModel {
    const props = entity.getProps();
    return {
      id: props.id,
      target_url: props.targetUrl.unpack(),
      label: props.label,
      created_by_staff_id: props.createdByStaffId,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    };
  }

  toResponse(entity: QrLinkEntity): QrLinkResponseDto {
    const props = entity.getProps();
    return Object.assign(new QrLinkResponseDto(), {
      id: props.id,
      targetUrl: props.targetUrl.unpack(),
      label: props.label,
      createdByStaffId: props.createdByStaffId,
      createdAt: props.createdAt.toISOString(),
      imageUrl: `/api/v1/qr-links/${props.id}/image.svg`,
    });
  }
}
