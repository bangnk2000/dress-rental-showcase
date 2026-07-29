import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubjectAttributes } from '../../../../libs/authz/authz.types';
import { CurrentSubject } from '../../guards/current-subject.decorator';
import { MeQuery } from './me.query';
import { MeResponseDto } from './me.response.dto';

@ApiTags('identity')
@ApiBearerAuth()
@Controller({ path: 'auth', version: '1' })
export class MeHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('me')
  @ApiOperation({ summary: 'Current authenticated staff profile' })
  @ApiOkResponse({ type: MeResponseDto })
  async me(@CurrentSubject() subject: SubjectAttributes): Promise<MeResponseDto> {
    return this.queryBus.execute(new MeQuery(subject.staffId));
  }
}
