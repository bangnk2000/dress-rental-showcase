import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListDressesQuery } from './list-dresses.query';
import { ListDressesRequestDto } from './list-dresses.request.dto';
import { DressListResponseDto } from './list-dresses.response.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'dresses', version: '1' })
export class ListDressesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'List dresses (paginated, filter by code/name/status)' })
  @ApiOkResponse({ type: DressListResponseDto })
  async list(@Query() dto: ListDressesRequestDto): Promise<DressListResponseDto> {
    return this.queryBus.execute(
      new ListDressesQuery({
        q: dto.q,
        status: dto.status,
        categoryId: dto.categoryId,
        page: dto.page,
        limit: dto.limit,
      }),
    );
  }
}
