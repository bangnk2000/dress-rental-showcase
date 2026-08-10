import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListPriceHistoryQuery } from './list-price-history.query';
import { PriceHistoryListResponseDto } from './list-price-history.response.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'dresses', version: '1' })
export class ListPriceHistoryHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/price-history')
  @ApiOperation({
    summary:
      'Price + deposit version log of a dress, newest first (auth-only read — the prices are shop-public, so is their history; FR-CAT-06 §6.Q1). Unknown dress = empty list.',
  })
  @ApiOkResponse({ type: PriceHistoryListResponseDto })
  async list(@Param('id', ParseUUIDPipe) id: string): Promise<PriceHistoryListResponseDto> {
    return this.queryBus.execute(new ListPriceHistoryQuery({ dressId: id }));
  }
}
