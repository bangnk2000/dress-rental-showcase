import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../../libs/authz/public.decorator';
import { ApiErrorResponseDto } from '../../../../libs/exceptions';
import { PublicDressSummaryDto } from '../../dtos/public-dress.response.dto';
import { ListPublicDressesQuery } from './list-public-dresses.query';
import { ListPublicDressesRequestDto } from './list-public-dresses.request.dto';

/**
 * ANONYMOUS (no bearer token) — read by apps/web's server (ISR). Rate-limited per client IP
 * (`libs/throttle`), cacheable for 60 s. Registered BEFORE GetPublicDressHttpController.
 */
@ApiTags('catalog')
@Public()
@UseGuards(ThrottlerGuard)
@Controller({ path: 'public/dresses', version: '1' })
export class ListPublicDressesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({
    summary:
      'Public catalogue: published listings with ≥ 1 active dress, hot first then newest (anonymous)',
  })
  @ApiOkResponse({ type: [PublicDressSummaryDto] })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Unknown style / bad limit' })
  @ApiResponse({ status: 429, type: ApiErrorResponseDto, description: 'Rate limit exceeded' })
  async list(@Query() dto: ListPublicDressesRequestDto): Promise<PublicDressSummaryDto[]> {
    return this.queryBus.execute(
      new ListPublicDressesQuery({ style: dto.style, limit: dto.limit }),
    );
  }
}
