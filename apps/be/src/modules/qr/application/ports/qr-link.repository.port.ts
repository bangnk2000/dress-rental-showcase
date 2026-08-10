import { RepositoryPort } from '../../../../libs/ddd/repository.port';
import { QrLinkEntity } from '../../domain/qr-link.entity';

export const QR_LINK_REPOSITORY = Symbol('QR_LINK_REPOSITORY');

export interface QrLinkRepositoryPort extends RepositoryPort<QrLinkEntity> {}
