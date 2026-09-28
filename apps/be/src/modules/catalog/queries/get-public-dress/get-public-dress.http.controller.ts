import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../../libs/authz/public.decorator';
import { ApiErrorResponseDto, NotFoundException } from '../../../../libs/exceptions';
import { PublicDressDetailDto } from '../../dtos/public-dress.response.dto';
import { GetPublicDressQuery } from './get-public-dress.query';

/** ANONYMOUS, rate-limited, cacheable 60 s. Must be registered AFTER the list controller. */
@ApiTags('catalog')
@Public()
@UseGuards(ThrottlerGuard)
@Controller({ path: 'public/dresses', version: '1' })
export class GetPublicDressHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({
    summary: 'One public listing by slug (anonymous); 404 when unpublished or out of active dresses',
  })
  @ApiOkResponse({ type: PublicDressDetailDto })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: 'Not on the web' })
  @ApiResponse({ status: 429, type: ApiErrorResponseDto, description: 'Rate limit exceeded' })
  async get(@Param('slug') slug: string): Promise<PublicDressDetailDto> {
    const dress: PublicDressDetailDto | null = await this.queryBus.execute(
      new GetPublicDressQuery({ slug }),
    );
    if (!dress) throw new NotFoundException('Dress not found');
    return dress;
  }
}
