import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PoliciesGuard } from '../../libs/authz/policies.guard';
import { STAFF_USER_REPOSITORY } from './application/ports/staff-user.repository.port';
import { TokenService } from './application/token.service';
import { LoginHttpController } from './commands/login/login.http.controller';
import { LoginService } from './commands/login/login.service';
import { RefreshTokenHttpController } from './commands/refresh-token/refresh-token.http.controller';
import { RefreshTokenService } from './commands/refresh-token/refresh-token.service';
import { StaffUserMapper } from './database/staff-user.mapper';
import { StaffUserRepository } from './database/staff-user.repository';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MeHttpController } from './queries/me/me.http.controller';
import { MeQueryHandler } from './queries/me/me.query-handler';

@Module({
  imports: [CqrsModule, JwtModule.register({ global: true })],
  controllers: [LoginHttpController, RefreshTokenHttpController, MeHttpController],
  providers: [
    StaffUserMapper,
    TokenService,
    LoginService,
    RefreshTokenService,
    MeQueryHandler,
    { provide: STAFF_USER_REPOSITORY, useClass: StaffUserRepository },
    // Guard order matters: authentication first, then ABAC policy evaluation.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PoliciesGuard },
  ],
})
export class IdentityModule {}
