import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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
import { UserNotFoundError } from '../../domain/identity.errors';
import { ResetPasswordCommand } from './reset-password.command';
import { ResetPasswordOutcomeDto } from './reset-password.outcome.dto';
import { ResetPasswordRequestDto } from './reset-password.request.dto';
import { ResetPasswordResult } from './reset-password.service';

@ApiTags('identity')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class ResetPasswordHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user:manage')
  @ApiOperation({
    summary: 'Set a new password for a staff account (owner only; works on locked accounts too)',
  })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: ResetPasswordOutcomeDto,
    description: 'Business rejection: rejected_user_not_found',
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: 'Guard denial (GENERIC.FORBIDDEN): only the owner manages accounts',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request body' })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResetPasswordRequestDto,
  ): Promise<IdResponse> {
    const result: ResetPasswordResult = await this.commandBus.execute(
      new ResetPasswordCommand({ userId: id, newPassword: body.newPassword }),
    );

    return match(result, {
      Ok: (userId) => new IdResponse(userId),
      Err: (error: Error) => {
        if (error instanceof UserNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_user_not_found' });
        }
        throw error;
      },
    });
  }
}
