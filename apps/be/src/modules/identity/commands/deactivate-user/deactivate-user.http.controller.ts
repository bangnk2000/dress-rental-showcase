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
import { SubjectAttributes } from '../../../../libs/authz/authz.types';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { IdResponse } from '../../../../libs/ddd/id.response.dto';
import { ApiErrorResponseDto, BusinessOutcomeException } from '../../../../libs/exceptions';
import { CurrentSubject } from '../../guards/current-subject.decorator';
import {
  CannotDeactivateSelfError,
  UserAlreadyInactiveError,
  UserNotFoundError,
} from '../../domain/identity.errors';
import { DeactivateUserCommand } from './deactivate-user.command';
import { DeactivateUserOutcomeDto } from './deactivate-user.outcome.dto';
import { DeactivateUserResult } from './deactivate-user.service';

@ApiTags('identity')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class DeactivateUserHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user:manage')
  @ApiOperation({ summary: 'Lock a staff account (owner only; lock, never delete)' })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: DeactivateUserOutcomeDto,
    description:
      'Business rejection: rejected_user_not_found | rejected_user_already_inactive | rejected_cannot_deactivate_self',
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: 'Guard denial (GENERIC.FORBIDDEN): only the owner manages accounts',
  })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentSubject() subject: SubjectAttributes,
  ): Promise<IdResponse> {
    const result: DeactivateUserResult = await this.commandBus.execute(
      new DeactivateUserCommand({ userId: id, actorId: subject.staffId }),
    );

    return match(result, {
      Ok: (userId) => new IdResponse(userId),
      Err: (error: Error) => {
        if (error instanceof CannotDeactivateSelfError) {
          throw new BusinessOutcomeException({ status: 'rejected_cannot_deactivate_self' });
        }
        if (error instanceof UserNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_user_not_found' });
        }
        if (error instanceof UserAlreadyInactiveError) {
          throw new BusinessOutcomeException({ status: 'rejected_user_already_inactive' });
        }
        throw error;
      },
    });
  }
}
