import { AggregateRoot } from '../../../libs/ddd/aggregate-root.base';
import { CreateQrLinkProps, QrLinkProps } from './qr-link.types';

/** Immutable record: replacing a printed QR always creates a new audit entry. */
export class QrLinkEntity extends AggregateRoot<QrLinkProps> {
  static create(create: CreateQrLinkProps, id: string, now: Date): QrLinkEntity {
    return new QrLinkEntity({ id, props: create, createdAt: now, updatedAt: now });
  }

  public validate(): void {
    this.guardAgainstEmpty(this.props.targetUrl, 'targetUrl');
    this.guardAgainstEmpty(this.props.createdByStaffId, 'createdByStaffId');
  }
}
