import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListRentalsQuery } from './list-rentals.query';
import { ListRentalsRequestDto } from './list-rentals.request.dto';
import { RentalListResponseDto } from './list-rentals.response.dto';

@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class ListRentalsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'List rentals (paginated, search customer name/phone, filter by status)' })
  @ApiOkResponse({ type: RentalListResponseDto })
  async list(@Query() dto: ListRentalsRequestDto): Promise<RentalListResponseDto> {
    return this.queryBus.execute(
      new ListRentalsQuery({ q: dto.q, status: dto.status, page: dto.page, limit: dto.limit }),
    );
  }
}
