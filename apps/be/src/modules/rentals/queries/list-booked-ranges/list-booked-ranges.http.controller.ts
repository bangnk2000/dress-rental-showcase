import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotFoundException } from '../../../../libs/exceptions';
import { BookedRangeListResponseDto } from './list-booked-ranges.response.dto';
import { ListBookedRangesQuery } from './list-booked-ranges.query';

/**
 * Rentals-owned read nested under the dress path: the calendar data belongs to
 * the rentals context even though the URL reads as a dress sub-resource.
 */
@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'dresses', version: '1' })
export class ListBookedRangesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':dressId/booked-ranges')
  @ApiOperation({ summary: 'List the blocking bookings of a dress (rental + cleaning buffer)' })
  @ApiOkResponse({ type: BookedRangeListResponseDto })
  @ApiResponse({ status: 404, description: 'Dress not found' })
  async list(
    @Param('dressId', ParseUUIDPipe) dressId: string,
  ): Promise<BookedRangeListResponseDto> {
    const result: BookedRangeListResponseDto | null = await this.queryBus.execute(
      new ListBookedRangesQuery({ dressId }),
    );
    if (!result) {
      throw new NotFoundException('Dress not found');
    }
    return result;
  }
}
