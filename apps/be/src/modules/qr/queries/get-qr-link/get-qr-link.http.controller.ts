import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { NotFoundException } from '../../../../libs/exceptions';
import { QrLinkResponseDto } from '../../dtos/qr-link.response.dto';
import { GetQrLinkQuery } from './get-qr-link.query';

@ApiTags('qr-links')
@ApiBearerAuth()
@Controller({ path: 'qr-links', version: '1' })
export class GetQrLinkHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @RequirePermission('qr:read')
  @ApiOperation({ summary: 'Get QR link metadata' })
  @ApiOkResponse({ type: QrLinkResponseDto })
  @ApiResponse({ status: 404, description: 'QR link not found' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<QrLinkResponseDto> {
    const qrLink = await this.queryBus.execute<GetQrLinkQuery, QrLinkResponseDto | null>(new GetQrLinkQuery(id));
    if (!qrLink) throw new NotFoundException('QR link not found');
    return qrLink;
  }
}
