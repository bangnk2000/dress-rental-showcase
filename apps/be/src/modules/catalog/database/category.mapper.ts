import { Injectable } from '@nestjs/common';
import { Mapper } from '../../../libs/ddd/mapper.interface';
import { toDate } from '../../../libs/utils/date';
import { CategoryName } from '../domain/category-name.value-object';
import { CategoryEntity } from '../domain/category.entity';
import { CategoryDto } from '../queries/list-categories/list-categories.response.dto';
import { CategoryModel } from './category.persistence.model';

@Injectable()
export class CategoryMapper implements Mapper<CategoryEntity, CategoryModel, CategoryDto> {
  toDomain(record: CategoryModel): CategoryEntity {
    return new CategoryEntity({
      id: record.id,
      createdAt: toDate(record.created_at),
      updatedAt: toDate(record.updated_at),
      props: { name: CategoryName.create(record.name) },
    });
  }

  toPersistence(entity: CategoryEntity): CategoryModel {
    const props = entity.getProps();
    return {
      id: props.id,
      name: props.name.unpack(),
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    };
  }

  // The list projection computes dressCount itself; this shape serves single-entity responses.
  toResponse(entity: CategoryEntity): CategoryDto {
    const props = entity.getProps();
    return Object.assign(new CategoryDto(), {
      id: props.id,
      name: props.name.unpack(),
      dressCount: 0,
    });
  }
}
