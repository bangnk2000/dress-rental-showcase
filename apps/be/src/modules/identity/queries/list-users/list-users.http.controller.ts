import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { ApiErrorResponseDto } from '../../../../libs/exceptions';
import { ListUsersQuery } from './list-users.query';
import { UserListResponseDto } from './list-users.response.dto';

@ApiTags('identity')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class ListUsersHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @RequirePermission('user:manage')
  @ApiOperation({ summary: 'List all staff accounts (owner only; unpaginated by design, <10 rows)' })
  @ApiOkResponse({ type: UserListResponseDto })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: 'Guard denial (GENERIC.FORBIDDEN): only the owner manages accounts',
  })
  async list(): Promise<UserListResponseDto> {
    return this.queryBus.execute(new ListUsersQuery());
  }
}
