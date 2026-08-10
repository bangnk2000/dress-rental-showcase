import { RepositoryPort } from '../../../../libs/ddd/repository.port';
import { CategoryEntity } from '../../domain/category.entity';

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

export interface CategoryRepositoryPort extends RepositoryPort<CategoryEntity> {
  /** Case-insensitive — 'Dạ Hội' finds 'dạ hội'. */
  findOneByName(name: string): Promise<CategoryEntity | null>;
  /** How many dresses point at the category (the delete pre-check payload). */
  countDresses(categoryId: string): Promise<number>;
  /** Throws CategoryStillReferencedError when the FK refuses (a race past the pre-check). */
  deleteById(categoryId: string): Promise<void>;
}
