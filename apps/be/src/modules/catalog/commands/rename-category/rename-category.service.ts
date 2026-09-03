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
import { CategoryNameTakenError, CategoryNotFoundError } from '../../domain/category.errors';
import { RenameCategoryCommand } from './rename-category.command';

export type RenameCategoryResult = Result<
  AggregateID,
  CategoryNotFoundError | CategoryNameTakenError
>;

@CommandHandler(RenameCategoryCommand)
export class RenameCategoryService
  implements ICommandHandler<RenameCategoryCommand, RenameCategoryResult>
{
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepo: CategoryRepositoryPort,
  ) {}

  async execute(command: RenameCategoryCommand): Promise<RenameCategoryResult> {
    const category = await this.categoryRepo.findOneById(command.categoryId);
    if (!category) return Err(new CategoryNotFoundError());

    const name = CategoryName.create(command.name);
    const current = category.name.unpack();

    // Renaming to itself (any casing) is a no-op the taken-check must not refuse.
    if (name.unpack().toLowerCase() !== current.toLowerCase()) {
      const taken = await this.categoryRepo.findOneByName(name.unpack());
      if (taken) return Err(new CategoryNameTakenError(name.unpack()));
    }

    category.rename(name, new Date());

    try {
      await this.categoryRepo.save(category);
    } catch (error) {
      if (error instanceof CategoryNameConflictError) {
        return Err(new CategoryNameTakenError(name.unpack(), error));
      }
      throw error;
    }
    return Ok(category.id);
  }
}
