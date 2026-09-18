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
import { RentalDetailDto } from './get-rental.response.dto';
import { GetRentalQuery } from './get-rental.query';

/**
 * Registered LAST in the module: Express matches routes in registration order, so `:id` must
 * come after the literal `today-board` path or ParseUUIDPipe would 400 the board.
 */
@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class GetRentalHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @ApiOperation({
    summary:
      'One rental in full (FR-RENT-12): customer, dates, dresses with agreed prices and calendar blocks, discount, notes, status',
  })
  @ApiOkResponse({ type: RentalDetailDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'Rental not found — a read that finds nothing is a fault, not an outcome',
  })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<RentalDetailDto> {
    const result: RentalDetailDto | null = await this.queryBus.execute(
      new GetRentalQuery({ rentalId: id }),
    );
    if (!result) {
      throw new NotFoundException('Rental not found');
    }
    return result;
  }
}
