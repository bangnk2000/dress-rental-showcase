import { CreateCategoryCommand } from './create-category.command';
import { CreateCategoryService } from './create-category.service';
import { DeleteCategoryCommand } from '../delete-category/delete-category.command';
import { DeleteCategoryService } from '../delete-category/delete-category.service';
import { RenameCategoryCommand } from '../rename-category/rename-category.command';
import { RenameCategoryService } from '../rename-category/rename-category.service';
import { CategoryNameConflictError } from '../../application/ports/category-name-conflict.error';
import { CategoryStillReferencedError } from '../../application/ports/category-still-referenced.error';
import { CategoryRepositoryPort } from '../../application/ports/category.repository.port';
import { CategoryName } from '../../domain/category-name.value-object';
import { CategoryEntity } from '../../domain/category.entity';
import {
  CategoryInUseError,
  CategoryNameTakenError,
  CategoryNotFoundError,
} from '../../domain/category.errors';

const CATEGORY_ID = '00000000-0000-4000-8000-0000000000c1';

function makeCategory(name = 'Dạ hội'): CategoryEntity {
  return CategoryEntity.create(CategoryName.create(name), CATEGORY_ID, new Date('2026-01-01'));
}

function makeRepo(overrides: Partial<CategoryRepositoryPort> = {}): CategoryRepositoryPort {
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(makeCategory()),
    findOneByName: jest.fn().mockResolvedValue(null),
    countDresses: jest.fn().mockResolvedValue(0),
    deleteById: jest.fn().mockResolvedValue(undefined),
    nextId: jest.fn().mockReturnValue(CATEGORY_ID),
    ...overrides,
  };
}

describe('CreateCategoryService', () => {
  it('creates a category with the TRIMMED name, original casing kept', async () => {
    const repo = makeRepo();
    const result = await new CreateCategoryService(repo).execute(
      new CreateCategoryCommand({ name: '  Dạ Hội  ' }),
    );

    expect(result.isOk()).toBe(true);
    const inserted = (repo.insert as jest.Mock).mock.calls[0][0] as CategoryEntity;
    expect(inserted.name.unpack()).toBe('Dạ Hội');
    expect(inserted.domainEvents).toHaveLength(1);
  });

  it('a taken name (any casing) is refused with the trimmed name in the payload', async () => {
    const repo = makeRepo({ findOneByName: jest.fn().mockResolvedValue(makeCategory()) });
    const result = await new CreateCategoryService(repo).execute(
      new CreateCategoryCommand({ name: 'dạ hội' }),
    );

    expect(result.unwrapErr()).toBeInstanceOf(CategoryNameTakenError);
    expect((result.unwrapErr() as CategoryNameTakenError).name).toBe('dạ hội');
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('answers the SAME rejection when the UNIQUE index catches the race', async () => {
    const repo = makeRepo({
      insert: jest.fn().mockRejectedValue(new CategoryNameConflictError()),
    });
    const result = await new CreateCategoryService(repo).execute(
      new CreateCategoryCommand({ name: 'Cưới' }),
    );
    expect(result.unwrapErr()).toBeInstanceOf(CategoryNameTakenError);
  });
});

describe('RenameCategoryService', () => {
  it('renames, and renaming to ITSELF with different casing skips the taken-check', async () => {
    const repo = makeRepo();
    const result = await new RenameCategoryService(repo).execute(
      new RenameCategoryCommand({ categoryId: CATEGORY_ID, name: 'DẠ HỘI' }),
    );

    expect(result.isOk()).toBe(true);
    expect(repo.findOneByName).not.toHaveBeenCalled(); // same name, other casing = no-op check
    const saved = (repo.save as jest.Mock).mock.calls[0][0] as CategoryEntity;
    expect(saved.name.unpack()).toBe('DẠ HỘI');
  });

  it('renaming to ANOTHER taken name is refused', async () => {
    const repo = makeRepo({
      findOneByName: jest.fn().mockResolvedValue(makeCategory('Cưới')),
    });
    const result = await new RenameCategoryService(repo).execute(
      new RenameCategoryCommand({ categoryId: CATEGORY_ID, name: 'Cưới' }),
    );
    expect(result.unwrapErr()).toBeInstanceOf(CategoryNameTakenError);
  });

  it('unknown category is its own rejection', async () => {
    const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(null) });
    const result = await new RenameCategoryService(repo).execute(
      new RenameCategoryCommand({ categoryId: CATEGORY_ID, name: 'Mới' }),
    );
    expect(result.unwrapErr()).toBeInstanceOf(CategoryNotFoundError);
  });
});

describe('DeleteCategoryService', () => {
  it('deletes an EMPTY category', async () => {
    const repo = makeRepo();
    const result = await new DeleteCategoryService(repo).execute(
      new DeleteCategoryCommand({ categoryId: CATEGORY_ID }),
    );
    expect(result.isOk()).toBe(true);
    expect(repo.deleteById).toHaveBeenCalledWith(CATEGORY_ID);
  });

  it('one still holding dresses is refused with the COUNT — never a silent bulk un-labelling', async () => {
    const repo = makeRepo({ countDresses: jest.fn().mockResolvedValue(12) });
    const result = await new DeleteCategoryService(repo).execute(
      new DeleteCategoryCommand({ categoryId: CATEGORY_ID }),
    );

    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(CategoryInUseError);
    expect((error as CategoryInUseError).dressCount).toBe(12);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it('a dress assigned AFTER the pre-check surfaces as the same outcome with a fresh count', async () => {
    const repo = makeRepo({
      countDresses: jest
        .fn()
        .mockResolvedValueOnce(0) // pre-check saw an empty category
        .mockResolvedValueOnce(1), // re-query after the FK refused
      deleteById: jest.fn().mockRejectedValue(new CategoryStillReferencedError()),
    });
    const result = await new DeleteCategoryService(repo).execute(
      new DeleteCategoryCommand({ categoryId: CATEGORY_ID }),
    );

    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(CategoryInUseError);
    expect((error as CategoryInUseError).dressCount).toBe(1);
  });
});
