import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { InvalidCredentialsError } from '../../domain/identity.errors';
import {
  STAFF_USER_REPOSITORY,
  StaffUserRepositoryPort,
} from '../../application/ports/staff-user.repository.port';
import { TokenPair, TokenService } from '../../application/token.service';
import { RefreshTokenCommand } from './refresh-token.command';

export type RefreshTokenResult = Result<TokenPair, InvalidCredentialsError>;

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenService
  implements ICommandHandler<RefreshTokenCommand, RefreshTokenResult>
{
  constructor(
    @Inject(STAFF_USER_REPOSITORY)
    private readonly staffRepo: StaffUserRepositoryPort,
    private readonly tokenService: TokenService,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    const staffId = await this.tokenService.verifyRefreshToken(command.refreshToken);
    if (!staffId) return Err(new InvalidCredentialsError());

    // The account must still exist (and keeps its CURRENT role) at refresh time.
    const staff = await this.staffRepo.findOneById(staffId);
    if (!staff) return Err(new InvalidCredentialsError());

    return Ok(await this.tokenService.issuePair(staff.id, staff.role));
  }
}
