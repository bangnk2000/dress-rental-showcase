import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { CategoryStillReferencedError } from '../../application/ports/category-still-referenced.error';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '../../application/ports/category.repository.port';
import { CategoryInUseError, CategoryNotFoundError } from '../../domain/category.errors';
import { DeleteCategoryCommand } from './delete-category.command';

export type DeleteCategoryResult = Result<
  AggregateID,
  CategoryNotFoundError | CategoryInUseError
>;

/**
 * Deleting never touches dresses (R3/R4): the count pre-check answers with HOW MANY dresses
 * stand in the way, and the FK ON DELETE RESTRICT referees the race past that check.
 */
@CommandHandler(DeleteCategoryCommand)
export class DeleteCategoryService
  implements ICommandHandler<DeleteCategoryCommand, DeleteCategoryResult>
{
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepo: CategoryRepositoryPort,
  ) {}

  async execute(command: DeleteCategoryCommand): Promise<DeleteCategoryResult> {
    const category = await this.categoryRepo.findOneById(command.categoryId);
    if (!category) return Err(new CategoryNotFoundError());

    const dressCount = await this.categoryRepo.countDresses(command.categoryId);
    if (dressCount > 0) return Err(new CategoryInUseError(dressCount));

    try {
      await this.categoryRepo.deleteById(command.categoryId);
    } catch (error) {
      if (error instanceof CategoryStillReferencedError) {
        // A dress was assigned after the pre-check: same rule, same outcome, fresh count.
        const now = await this.categoryRepo.countDresses(command.categoryId);
        return Err(new CategoryInUseError(now > 0 ? now : 1, error));
      }
      throw error;
    }
    return Ok(command.categoryId);
  }
}
