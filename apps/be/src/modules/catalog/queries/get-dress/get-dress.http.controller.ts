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
import { DressResponseDto } from '../../dtos/dress.response.dto';
import { GetDressQuery } from './get-dress.query';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'dresses', version: '1' })
export class GetDressHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get one dress by id' })
  @ApiOkResponse({ type: DressResponseDto })
  @ApiResponse({ status: 404, description: 'Dress not found' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<DressResponseDto> {
    const dress: DressResponseDto | null = await this.queryBus.execute(
      new GetDressQuery({ dressId: id }),
    );
    if (!dress) {
      throw new NotFoundException('Dress not found');
    }
    return dress;
  }
}
