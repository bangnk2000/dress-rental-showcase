import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { match } from 'oxide.ts';
import { BusinessOutcomeException } from '../../../../libs/exceptions';
import { InvalidCredentialsError } from '../../domain/identity.errors';
import { TokenPairResponseDto } from '../../dtos/token-pair.response.dto';
import { Public } from '../../guards/public.decorator';
import { RefreshTokenCommand } from './refresh-token.command';
import { RefreshTokenOutcomeDto } from './refresh-token.outcome.dto';
import { RefreshTokenRequestDto } from './refresh-token.request.dto';
import { RefreshTokenResult } from './refresh-token.service';

@ApiTags('identity')
@Controller({ path: 'auth', version: '1' })
export class RefreshTokenHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiOkResponse({ type: TokenPairResponseDto })
  @ApiResponse({
    status: 422,
    type: RefreshTokenOutcomeDto,
    description:
      'Business rejection: rejected_invalid_refresh_token — terminal, the client clears the session (ADR 0001)',
  })
  async refresh(@Body() body: RefreshTokenRequestDto): Promise<TokenPairResponseDto> {
    const result: RefreshTokenResult = await this.commandBus.execute(
      new RefreshTokenCommand({ refreshToken: body.refreshToken }),
    );

    return match(result, {
      Ok: (pair) => Object.assign(new TokenPairResponseDto(), pair),
      Err: (error: Error) => {
        if (error instanceof InvalidCredentialsError) {
          throw new BusinessOutcomeException({ status: 'rejected_invalid_refresh_token' });
        }
        throw error;
      },
    });
  }
}
