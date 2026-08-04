import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { QR_LINK_REPOSITORY } from './application/ports/qr-link.repository.port';
import { QR_RENDERER } from './application/ports/qr-renderer.port';
import { QrcodeSvgRendererAdapter } from './adapters/qrcode-svg-renderer.adapter';
import { CreateUrlCodeHttpController } from './commands/create-url-code/create-url-code.http.controller';
import { CreateUrlCodeService } from './commands/create-url-code/create-url-code.service';
import { QrLinkMapper } from './database/qr-link.mapper';
import { QrLinkRepository } from './database/qr-link.repository';
import { GetQrLinkHttpController } from './queries/get-qr-link/get-qr-link.http.controller';
import { GetQrLinkQueryHandler } from './queries/get-qr-link/get-qr-link.query-handler';
import { ListQrLinksHttpController } from './queries/list-qr-links/list-qr-links.http.controller';
import { ListQrLinksQueryHandler } from './queries/list-qr-links/list-qr-links.query-handler';
import { RenderQrLinkSvgHttpController } from './queries/render-qr-link-svg/render-qr-link-svg.http.controller';
import { RenderQrLinkSvgQueryHandler } from './queries/render-qr-link-svg/render-qr-link-svg.query-handler';
import './qr.policies';

@Module({
  imports: [CqrsModule],
  controllers: [CreateUrlCodeHttpController, ListQrLinksHttpController, GetQrLinkHttpController, RenderQrLinkSvgHttpController],
  providers: [
    QrLinkMapper,
    CreateUrlCodeService,
    ListQrLinksQueryHandler,
    GetQrLinkQueryHandler,
    RenderQrLinkSvgQueryHandler,
    { provide: QR_LINK_REPOSITORY, useClass: QrLinkRepository },
    { provide: QR_RENDERER, useClass: QrcodeSvgRendererAdapter },
  ],
})
export class QrModule {}
