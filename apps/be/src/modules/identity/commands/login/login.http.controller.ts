import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { match } from 'oxide.ts';
import { ApiErrorResponseDto, BusinessOutcomeException } from '../../../../libs/exceptions';
import { AccountLockedError, InvalidCredentialsError } from '../../domain/identity.errors';
import { TokenPairResponseDto } from '../../dtos/token-pair.response.dto';
import { Public } from '../../guards/public.decorator';
import { LoginCommand } from './login.command';
import { LoginOutcomeDto } from './login.outcome.dto';
import { LoginRequestDto } from './login.request.dto';
import { LoginResult } from './login.service';

@ApiTags('identity')
@Controller({ path: 'auth', version: '1' })
export class LoginHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Staff login with username + password' })
  @ApiOkResponse({ type: TokenPairResponseDto })
  @ApiResponse({
    status: 422,
    type: LoginOutcomeDto,
    description:
      'Business rejection: rejected_invalid_credentials | rejected_account_locked. NOT 401 — 401 means only that a guard rejected an access token (ADR 0001)',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request body' })
  async login(@Body() body: LoginRequestDto): Promise<TokenPairResponseDto> {
    const result: LoginResult = await this.commandBus.execute(
      new LoginCommand({ username: body.username, password: body.password }),
    );

    return match(result, {
      Ok: (pair) => Object.assign(new TokenPairResponseDto(), pair),
      Err: (error: Error) => {
        if (error instanceof AccountLockedError) {
          throw new BusinessOutcomeException({ status: 'rejected_account_locked' });
        }
        if (error instanceof InvalidCredentialsError) {
          throw new BusinessOutcomeException({ status: 'rejected_invalid_credentials' });
        }
        throw error;
      },
    });
  }
}
