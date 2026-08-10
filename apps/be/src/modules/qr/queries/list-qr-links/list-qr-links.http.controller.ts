import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { ListQrLinksQuery } from './list-qr-links.query';
import { ListQrLinksRequestDto } from './list-qr-links.request.dto';
import { QrLinkListResponseDto } from './list-qr-links.response.dto';

@ApiTags('qr-links')
@ApiBearerAuth()
@Controller({ path: 'qr-links', version: '1' })
export class ListQrLinksHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @RequirePermission('qr:list')
  @ApiOperation({ summary: 'List QR links newest first' })
  @ApiOkResponse({ type: QrLinkListResponseDto })
  async list(@Query() dto: ListQrLinksRequestDto): Promise<QrLinkListResponseDto> {
    return this.queryBus.execute(new ListQrLinksQuery({ page: dto.page, limit: dto.limit }));
  }
}
