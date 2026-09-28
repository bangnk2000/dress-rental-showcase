import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListingListResponseDto } from '../../dtos/listing.response.dto';
import { ListListingsQuery } from './list-listings.query';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'listings', version: '1' })
export class ListListingsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    summary: 'List every public listing, drafts included, with dress/size counts (auth-only read)',
  })
  @ApiOkResponse({ type: ListingListResponseDto })
  async list(): Promise<ListingListResponseDto> {
    return this.queryBus.execute(new ListListingsQuery());
  }
}
