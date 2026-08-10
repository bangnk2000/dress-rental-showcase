import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabasePool, ForeignKeyIntegrityConstraintViolationError, sql } from 'slonik';
import { z } from 'zod';
import { SqlRepositoryBase } from '../../../libs/db/sql-repository.base';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import { ConflictException } from '../../../libs/exceptions';
import { LOGGER_PORT, LoggerPort } from '../../../libs/ports/logger.port';
import { CategoryEntity } from '../domain/category.entity';
import { CategoryNameConflictError } from '../application/ports/category-name-conflict.error';
import { CategoryStillReferencedError } from '../application/ports/category-still-referenced.error';
import { CategoryRepositoryPort } from '../application/ports/category.repository.port';
import { CategoryMapper } from './category.mapper';
import { CategoryModel, categorySchema } from './category.persistence.model';

const countSchema = z.object({ total: z.number().int() });

@Injectable()
export class CategoryRepository
  extends SqlRepositoryBase<CategoryEntity, CategoryModel>
  implements CategoryRepositoryPort
{
  protected tableName = 'categories';
  protected schema = categorySchema;

  constructor(
    @Inject(DB_POOL) pool: DatabasePool,
    mapper: CategoryMapper,
    @Inject(LOGGER_PORT) logger: LoggerPort,
    eventEmitter: EventEmitter2,
  ) {
    super(pool, mapper, logger, eventEmitter);
  }

  /** `categories` has exactly ONE uniqueness constraint — lower(name) — same reasoning as dresses. */
  async insert(entity: CategoryEntity): Promise<void> {
    await this.translateNameConflict(() => super.insert(entity));
  }

  async save(entity: CategoryEntity): Promise<void> {
    await this.translateNameConflict(() => super.save(entity));
  }

  private async translateNameConflict(write: () => Promise<void>): Promise<void> {
    try {
      await write();
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new CategoryNameConflictError(error);
      }
      throw error;
    }
  }

  async findOneByName(name: string): Promise<CategoryEntity | null> {
    const row = await this.pool.maybeOne(
      sql.type(this.schema)`
        SELECT * FROM categories WHERE lower(name) = ${name.trim().toLowerCase()} LIMIT 1
      `,
    );
    return row ? this.mapper.toDomain(row) : null;
  }

  async countDresses(categoryId: string): Promise<number> {
    const { total } = await this.pool.one(
      sql.type(countSchema)`
        SELECT count(*)::int AS total FROM dresses WHERE category_id = ${categoryId}
      `,
    );
    return total;
  }

  async deleteById(categoryId: string): Promise<void> {
    try {
      await this.pool.query(sql.unsafe`DELETE FROM categories WHERE id = ${categoryId}`);
    } catch (error) {
      if (error instanceof ForeignKeyIntegrityConstraintViolationError) {
        // A dress was assigned between the pre-check and this delete — the FK is the referee.
        throw new CategoryStillReferencedError(error as Error);
      }
      throw error;
    }
  }
}
