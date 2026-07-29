import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { compare } from 'bcryptjs';
import { Err, Ok, Result } from 'oxide.ts';
import { InvalidCredentialsError } from '../../domain/identity.errors';
import {
  STAFF_USER_REPOSITORY,
  StaffUserRepositoryPort,
} from '../../application/ports/staff-user.repository.port';
import { TokenPair, TokenService } from '../../application/token.service';
import { LoginCommand } from './login.command';

export type LoginResult = Result<TokenPair, InvalidCredentialsError>;

@CommandHandler(LoginCommand)
export class LoginService implements ICommandHandler<LoginCommand, LoginResult> {
  constructor(
    @Inject(STAFF_USER_REPOSITORY)
    private readonly staffRepo: StaffUserRepositoryPort,
    private readonly tokenService: TokenService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const staff = await this.staffRepo.findOneByEmail(command.email);
    if (!staff) return Err(new InvalidCredentialsError());

    const passwordMatches = await compare(command.password, staff.passwordHash);
    if (!passwordMatches) return Err(new InvalidCredentialsError());

    return Ok(await this.tokenService.issuePair(staff.id, staff.role));
  }
}
