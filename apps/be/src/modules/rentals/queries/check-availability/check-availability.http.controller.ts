import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotFoundException } from '../../../../libs/exceptions';
import { AvailabilityResponseDto } from './check-availability.response.dto';
import { CheckAvailabilityQuery } from './check-availability.query';
import { CheckAvailabilityRequestDto } from './check-availability.request.dto';

/**
 * Rentals-owned read nested under the dress path: "is dress X free from A to
 * B" is answered by the rentals context (same buffer semantics as create).
 */
@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'dresses', version: '1' })
export class CheckAvailabilityHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':dressId/availability')
  @ApiOperation({ summary: 'Is the dress free for [startDate, endDate]? (cleaning buffer included)' })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  @ApiResponse({ status: 404, description: 'Dress not found' })
  async check(
    @Param('dressId', ParseUUIDPipe) dressId: string,
    @Query() dto: CheckAvailabilityRequestDto,
  ): Promise<AvailabilityResponseDto> {
    const result: AvailabilityResponseDto | null = await this.queryBus.execute(
      new CheckAvailabilityQuery({
        dressId,
        startDate: dto.startDate,
        endDate: dto.endDate,
      }),
    );
    if (!result) {
      throw new NotFoundException('Dress not found');
    }
    return result;
  }
}
