import { Body, Controller, Inject, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { CurrentSubject } from '../../../../libs/authz/current-subject.decorator';
import { SubjectAttributes } from '../../../../libs/authz/authz.types';
import { STAFF_LOOKUP, StaffLookupPort } from '../../application/ports/staff-lookup.port';
import { QrLinkMapper } from '../../database/qr-link.mapper';
import { QrLinkResponseDto } from '../../dtos/qr-link.response.dto';
import { CreateUrlCodeCommand } from './create-url-code.command';
import { CreateUrlCodeRequestDto } from './create-url-code.request.dto';
import { CreateUrlCodeResult } from './create-url-code.service';

@ApiTags('qr-links')
@ApiBearerAuth()
@Controller({ path: 'qr-links', version: '1' })
export class CreateUrlCodeHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: QrLinkMapper,
    @Inject(STAFF_LOOKUP) private readonly staffLookup: StaffLookupPort,
  ) {}

  @Post()
  @RequirePermission('qr:create')
  @ApiOperation({ summary: 'Create an immutable QR code for a target URL' })
  @ApiCreatedResponse({ type: QrLinkResponseDto })
  @ApiResponse({ status: 400, description: 'Target URL is invalid' })
  async create(
    @Body() body: CreateUrlCodeRequestDto,
    @CurrentSubject() subject: SubjectAttributes,
  ): Promise<QrLinkResponseDto> {
    const result: CreateUrlCodeResult = await this.commandBus.execute(
      new CreateUrlCodeCommand({
        targetUrl: body.targetUrl,
        label: body.label ?? null,
        createdByStaffId: subject.staffId,
      }),
    );
    // The one field the entity cannot carry: the creator's NAME lives in identity, and every
    // response of this shape states it (FR-QR-03).
    const names = await this.staffLookup.findNamesByIds([subject.staffId]);
    return Object.assign(this.mapper.toResponse(result.unwrap()), {
      createdByName: names.get(subject.staffId) ?? null,
    });
  }
}
