import { Injectable } from '@nestjs/common';
import { Mapper } from '../../../libs/ddd/mapper.interface';
import { toDate } from '../../../libs/utils/date';
import { StaffUserEntity } from '../domain/staff-user.entity';
import { StaffUserModel } from './staff-user.persistence.model';
import { MeResponseDto } from '../queries/me/me.response.dto';

@Injectable()
export class StaffUserMapper implements Mapper<StaffUserEntity, StaffUserModel, MeResponseDto> {
  // Reconstitution builds the entity directly — create() is reserved for genuinely new aggregates.
  toDomain(record: StaffUserModel): StaffUserEntity {
    return new StaffUserEntity({
      id: record.id,
      createdAt: toDate(record.created_at),
      updatedAt: toDate(record.updated_at),
      props: {
        username: record.username,
        name: record.name,
        role: record.role,
        passwordHash: record.password_hash,
        active: record.active,
      },
    });
  }

  toPersistence(entity: StaffUserEntity): StaffUserModel {
    const props = entity.getProps();
    return {
      id: props.id,
      username: props.username,
      name: props.name,
      role: props.role,
      password_hash: props.passwordHash,
      active: props.active,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    };
  }

  toResponse(entity: StaffUserEntity): MeResponseDto {
    const props = entity.getProps();
    // passwordHash is never exposed.
    return Object.assign(new MeResponseDto(), {
      id: props.id,
      username: props.username,
      name: props.name,
      role: props.role,
    });
  }
}
