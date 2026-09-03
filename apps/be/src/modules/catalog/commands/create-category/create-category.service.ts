import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { CategoryNameConflictError } from '../../application/ports/category-name-conflict.error';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '../../application/ports/category.repository.port';
import { CategoryName } from '../../domain/category-name.value-object';
import { CategoryEntity } from '../../domain/category.entity';
import { CategoryNameTakenError } from '../../domain/category.errors';
import { CreateCategoryCommand } from './create-category.command';

export type CreateCategoryResult = Result<AggregateID, CategoryNameTakenError>;

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryService
  implements ICommandHandler<CreateCategoryCommand, CreateCategoryResult>
{
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepo: CategoryRepositoryPort,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<CreateCategoryResult> {
    const name = CategoryName.create(command.name);

    // Uniqueness precondition; the lower(name) UNIQUE index backs it against races.
    const existing = await this.categoryRepo.findOneByName(name.unpack());
    if (existing) return Err(new CategoryNameTakenError(name.unpack()));

    const category = CategoryEntity.create(name, this.categoryRepo.nextId(), new Date());

    try {
      await this.categoryRepo.insert(category);
    } catch (error) {
      if (error instanceof CategoryNameConflictError) {
        return Err(new CategoryNameTakenError(name.unpack(), error));
      }
      throw error;
    }
    return Ok(category.id);
  }
}
