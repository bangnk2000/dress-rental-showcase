import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponseDto, NotFoundException } from '../../../../libs/exceptions';
import { ListingDto } from '../../dtos/listing.response.dto';
import { GetListingQuery } from './get-listing.query';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'listings', version: '1' })
export class GetListingHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get one listing with its attached dresses (auth-only read)' })
  @ApiOkResponse({ type: ListingDto })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: 'Listing not found' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ListingDto> {
    const listing: ListingDto | null = await this.queryBus.execute(
      new GetListingQuery({ listingId: id }),
    );
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }
}
