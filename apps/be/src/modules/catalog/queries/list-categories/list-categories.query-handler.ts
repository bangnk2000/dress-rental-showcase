import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { ListCategoriesQuery } from './list-categories.query';
import { CategoryDto, CategoryListResponseDto } from './list-categories.response.dto';

const rowSchema = z.object({
  id: z.string(),
  name: z.string(),
  dress_count: z.number().int(),
});

@QueryHandler(ListCategoriesQuery)
export class ListCategoriesQueryHandler
  implements IQueryHandler<ListCategoriesQuery, CategoryListResponseDto>
{
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  // ONE grouped query: the management screen and the delete-button tooltip both need the count,
  // and counting on the FE would be an N+1 per category.
  async execute(): Promise<CategoryListResponseDto> {
    const rows = await this.pool.any(sql.type(rowSchema)`
      SELECT c.id, c.name, count(d.id)::int AS dress_count
      FROM categories c
      LEFT JOIN dresses d ON d.category_id = c.id
      GROUP BY c.id, c.name
      ORDER BY lower(c.name)
    `);
    const data: CategoryDto[] = rows.map((row) =>
      Object.assign(new CategoryDto(), {
        id: row.id,
        name: row.name,
        dressCount: row.dress_count,
      }),
    );
    return Object.assign(new CategoryListResponseDto(), { data });
  }
}
