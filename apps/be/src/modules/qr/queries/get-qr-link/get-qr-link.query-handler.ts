import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { toDate } from '../../../../libs/utils/date';
import { qrLinkSchema } from '../../database/qr-link.persistence.model';
import { QrLinkResponseDto } from '../../dtos/qr-link.response.dto';
import { GetQrLinkQuery } from './get-qr-link.query';

@QueryHandler(GetQrLinkQuery)
export class GetQrLinkQueryHandler implements IQueryHandler<GetQrLinkQuery, QrLinkResponseDto | null> {
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async execute(query: GetQrLinkQuery): Promise<QrLinkResponseDto | null> {
    const row = await this.pool.maybeOne(sql.type(qrLinkSchema)`SELECT * FROM qr_links WHERE id = ${query.qrLinkId}`);
    if (!row) return null;
    return Object.assign(new QrLinkResponseDto(), {
      id: row.id, targetUrl: row.target_url, label: row.label, createdByStaffId: row.created_by_staff_id,
      createdAt: toDate(row.created_at).toISOString(), imageUrl: `/api/v1/qr-links/${row.id}/image.svg`,
    });
  }
}
