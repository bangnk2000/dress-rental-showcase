import { Controller, Get, Header, Param, ParseUUIDPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { NotFoundException } from '../../../../libs/exceptions';
import { RenderQrLinkSvgQuery } from './render-qr-link-svg.query';

@ApiTags('qr-links')
@ApiBearerAuth()
@Controller({ path: 'qr-links', version: '1' })
export class RenderQrLinkSvgHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/image.svg')
  @Header('Content-Type', 'image/svg+xml')
  @RequirePermission('qr:read')
  @ApiOperation({ summary: 'Render the persisted target URL as QR SVG' })
  @ApiOkResponse({ description: 'SVG image', content: { 'image/svg+xml': { schema: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 404, description: 'QR link not found' })
  async render(@Param('id', ParseUUIDPipe) id: string): Promise<string> {
    const svg = await this.queryBus.execute<RenderQrLinkSvgQuery, string | null>(new RenderQrLinkSvgQuery(id));
    if (!svg) throw new NotFoundException('QR link not found');
    return svg;
  }
}
