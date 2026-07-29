import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { match } from 'oxide.ts';
import { UnauthorizedException } from '../../../../libs/exceptions';
import { InvalidCredentialsError } from '../../domain/identity.errors';
import { TokenPairResponseDto } from '../../dtos/token-pair.response.dto';
import { Public } from '../../guards/public.decorator';
import { LoginCommand } from './login.command';
import { LoginRequestDto } from './login.request.dto';
import { LoginResult } from './login.service';

@ApiTags('identity')
@Controller({ path: 'auth', version: '1' })
export class LoginHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Staff login with email + password' })
  @ApiOkResponse({ type: TokenPairResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() body: LoginRequestDto): Promise<TokenPairResponseDto> {
    const result: LoginResult = await this.commandBus.execute(
      new LoginCommand({ email: body.email, password: body.password }),
    );

    return match(result, {
      Ok: (pair) => Object.assign(new TokenPairResponseDto(), pair),
      Err: (error: Error) => {
        if (error instanceof InvalidCredentialsError) {
          throw new UnauthorizedException(error.message);
        }
        throw error;
      },
    });
  }
}
