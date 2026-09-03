import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListCategoriesQuery } from './list-categories.query';
import { CategoryListResponseDto } from './list-categories.response.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'categories', version: '1' })
export class ListCategoriesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    summary: 'List categories with their dress counts (auth-only read; unpaginated by design)',
  })
  @ApiOkResponse({ type: CategoryListResponseDto })
  async list(): Promise<CategoryListResponseDto> {
    return this.queryBus.execute(new ListCategoriesQuery());
  }
}
