import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TodayBoardResponseDto } from './get-today-board.response.dto';
import { GetTodayBoardQuery } from './get-today-board.query';
import { GetTodayBoardRequestDto } from './get-today-board.request.dto';

/** The screen staff open every morning: what goes out, what comes back. */
@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class GetTodayBoardHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('today-board')
  @ApiOperation({ summary: 'Rentals due out and due back on a date (default: today)' })
  @ApiOkResponse({ type: TodayBoardResponseDto })
  async get(@Query() dto: GetTodayBoardRequestDto): Promise<TodayBoardResponseDto> {
    return this.queryBus.execute(new GetTodayBoardQuery({ date: dto.date ?? null }));
  }
}
