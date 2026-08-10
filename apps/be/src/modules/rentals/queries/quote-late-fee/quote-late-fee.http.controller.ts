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
import { LateFeeQuoteResponseDto } from './quote-late-fee.response.dto';
import { QuoteLateFeeQuery } from './quote-late-fee.query';

@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class QuoteLateFeeHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/late-fee')
  @ApiOperation({
    summary:
      'Late fee the shop should charge if the dresses come back today (FR-RENT-09) — read before settling',
  })
  @ApiOkResponse({ type: LateFeeQuoteResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'Rental not found — a read that finds nothing is a fault, not an outcome',
  })
  async quote(@Param('id', ParseUUIDPipe) id: string): Promise<LateFeeQuoteResponseDto> {
    const result: LateFeeQuoteResponseDto | null = await this.queryBus.execute(
      new QuoteLateFeeQuery({ rentalId: id }),
    );
    if (!result) {
      throw new NotFoundException('Rental not found');
    }
    return result;
  }
}
