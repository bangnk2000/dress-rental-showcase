import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { QR_RENDERER, QrRendererPort } from '../../application/ports/qr-renderer.port';
import { qrLinkSchema } from '../../database/qr-link.persistence.model';
import { RenderQrLinkSvgQuery } from './render-qr-link-svg.query';

@QueryHandler(RenderQrLinkSvgQuery)
export class RenderQrLinkSvgQueryHandler implements IQueryHandler<RenderQrLinkSvgQuery, string | null> {
  constructor(
    @Inject(DB_POOL) private readonly pool: DatabasePool,
    @Inject(QR_RENDERER) private readonly renderer: QrRendererPort,
  ) {}

  async execute(query: RenderQrLinkSvgQuery): Promise<string | null> {
    const row = await this.pool.maybeOne(sql.type(qrLinkSchema)`SELECT * FROM qr_links WHERE id = ${query.qrLinkId}`);
    return row ? this.renderer.renderSvg(row.target_url) : null;
  }
}
