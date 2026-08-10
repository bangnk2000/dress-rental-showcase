import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { match } from 'oxide.ts';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { IdResponse } from '../../../../libs/ddd/id.response.dto';
import { ApiErrorResponseDto, BusinessOutcomeException } from '../../../../libs/exceptions';
import { UsernameAlreadyExistsError } from '../../domain/identity.errors';
import { CreateUserCommand } from './create-user.command';
import { CreateUserOutcomeDto } from './create-user.outcome.dto';
import { CreateUserRequestDto } from './create-user.request.dto';
import { CreateUserResult } from './create-user.service';

@ApiTags('identity')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class CreateUserHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @RequirePermission('user:manage')
  @ApiOperation({ summary: 'Create a staff account (owner only; role is always staff)' })
  @ApiCreatedResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: CreateUserOutcomeDto,
    description: 'Business rejection: rejected_username_taken (carries the normalized username)',
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: 'Guard denial (GENERIC.FORBIDDEN): only the owner manages accounts',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request body' })
  async create(@Body() body: CreateUserRequestDto): Promise<IdResponse> {
    const result: CreateUserResult = await this.commandBus.execute(
      new CreateUserCommand({ username: body.username, name: body.name, password: body.password }),
    );

    return match(result, {
      Ok: (id) => new IdResponse(id),
      Err: (error: Error) => {
        if (error instanceof UsernameAlreadyExistsError) {
          throw new BusinessOutcomeException({
            status: 'rejected_username_taken',
            username: error.username,
          });
        }
        throw error;
      },
    });
  }
}
