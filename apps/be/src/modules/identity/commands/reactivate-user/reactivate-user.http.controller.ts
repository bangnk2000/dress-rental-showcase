import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { match } from 'oxide.ts';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { IdResponse } from '../../../../libs/ddd/id.response.dto';
import { ApiErrorResponseDto, BusinessOutcomeException } from '../../../../libs/exceptions';
import { UserAlreadyActiveError, UserNotFoundError } from '../../domain/identity.errors';
import { ReactivateUserCommand } from './reactivate-user.command';
import { ReactivateUserOutcomeDto } from './reactivate-user.outcome.dto';
import { ReactivateUserResult } from './reactivate-user.service';

@ApiTags('identity')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class ReactivateUserHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user:manage')
  @ApiOperation({ summary: 'Unlock a staff account (owner only)' })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: ReactivateUserOutcomeDto,
    description: 'Business rejection: rejected_user_not_found | rejected_user_already_active',
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: 'Guard denial (GENERIC.FORBIDDEN): only the owner manages accounts',
  })
  async reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<IdResponse> {
    const result: ReactivateUserResult = await this.commandBus.execute(
      new ReactivateUserCommand({ userId: id }),
    );

    return match(result, {
      Ok: (userId) => new IdResponse(userId),
      Err: (error: Error) => {
        if (error instanceof UserNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_user_not_found' });
        }
        if (error instanceof UserAlreadyActiveError) {
          throw new BusinessOutcomeException({ status: 'rejected_user_already_active' });
        }
        throw error;
      },
    });
  }
}
