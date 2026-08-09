import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DB_POOL } from '../../../../libs/db/db.di-tokens';
import { toDate } from '../../../../libs/utils/date';
import { STAFF_LOOKUP, StaffLookupPort } from '../../application/ports/staff-lookup.port';
import { qrLinkSchema } from '../../database/qr-link.persistence.model';
import { QrLinkResponseDto } from '../../dtos/qr-link.response.dto';
import { ListQrLinksQuery } from './list-qr-links.query';
import { QrLinkListResponseDto } from './list-qr-links.response.dto';

const countSchema = z.object({ total: z.number() });

@QueryHandler(ListQrLinksQuery)
export class ListQrLinksQueryHandler implements IQueryHandler<ListQrLinksQuery, QrLinkListResponseDto> {
  constructor(
    @Inject(DB_POOL) private readonly pool: DatabasePool,
    @Inject(STAFF_LOOKUP) private readonly staffLookup: StaffLookupPort,
  ) {}

  async execute(query: ListQrLinksQuery): Promise<QrLinkListResponseDto> {
    const rows = await this.pool.query(sql.type(qrLinkSchema)`
      SELECT * FROM qr_links ORDER BY created_at DESC, id DESC LIMIT ${query.limit} OFFSET ${query.offset}
    `);
    const { total } = await this.pool.one(sql.type(countSchema)`SELECT count(*)::int AS total FROM qr_links`);
    // One lookup for the PAGE, not one per row (FR-QR-03 names the creator on every row).
    const names = await this.staffLookup.findNamesByIds([
      ...new Set(rows.rows.map((row) => row.created_by_staff_id)),
    ]);
    return Object.assign(new QrLinkListResponseDto(), {
      data: rows.rows.map((row) => Object.assign(new QrLinkResponseDto(), {
        id: row.id,
        targetUrl: row.target_url,
        label: row.label,
        createdByStaffId: row.created_by_staff_id,
        createdByName: names.get(row.created_by_staff_id) ?? null,
        createdAt: toDate(row.created_at).toISOString(),
        imageUrl: `/api/v1/qr-links/${row.id}/image.svg`,
      })),
      count: total,
      limit: query.limit,
      page: query.page,
    });
  }
}
