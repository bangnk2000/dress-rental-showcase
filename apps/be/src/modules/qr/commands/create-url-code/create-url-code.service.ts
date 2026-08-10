import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Ok, Result } from 'oxide.ts';
import { QrLinkEntity } from '../../domain/qr-link.entity';
import { TargetUrl } from '../../domain/target-url.value-object';
import { QR_LINK_REPOSITORY, QrLinkRepositoryPort } from '../../application/ports/qr-link.repository.port';
import { CreateUrlCodeCommand } from './create-url-code.command';

export type CreateUrlCodeResult = Result<QrLinkEntity, never>;

@CommandHandler(CreateUrlCodeCommand)
export class CreateUrlCodeService implements ICommandHandler<CreateUrlCodeCommand, CreateUrlCodeResult> {
  constructor(@Inject(QR_LINK_REPOSITORY) private readonly qrLinkRepo: QrLinkRepositoryPort) {}

  async execute(command: CreateUrlCodeCommand): Promise<CreateUrlCodeResult> {
    const qrLink = QrLinkEntity.create(
      {
        targetUrl: TargetUrl.create(command.targetUrl),
        label: command.label,
        createdByStaffId: command.createdByStaffId,
      },
      this.qrLinkRepo.nextId(),
      new Date(),
    );
    await this.qrLinkRepo.insert(qrLink);
    return Ok(qrLink);
  }
}
