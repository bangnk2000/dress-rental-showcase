import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabasePool } from 'slonik';
import { SqlRepositoryBase } from '../../../libs/db/sql-repository.base';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import { LOGGER_PORT, LoggerPort } from '../../../libs/ports/logger.port';
import { QrLinkRepositoryPort } from '../application/ports/qr-link.repository.port';
import { QrLinkEntity } from '../domain/qr-link.entity';
import { QrLinkMapper } from './qr-link.mapper';
import { QrLinkModel, qrLinkSchema } from './qr-link.persistence.model';

@Injectable()
export class QrLinkRepository
  extends SqlRepositoryBase<QrLinkEntity, QrLinkModel>
  implements QrLinkRepositoryPort
{
  protected tableName = 'qr_links';
  protected schema = qrLinkSchema;

  constructor(
    @Inject(DB_POOL) pool: DatabasePool,
    mapper: QrLinkMapper,
    @Inject(LOGGER_PORT) logger: LoggerPort,
    eventEmitter: EventEmitter2,
  ) {
    super(pool, mapper, logger, eventEmitter);
  }
}
