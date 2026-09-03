import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PoliciesGuard } from '../../libs/authz/policies.guard';
import { STAFF_USER_REPOSITORY } from './application/ports/staff-user.repository.port';
import { TokenService } from './application/token.service';
import { CreateUserHttpController } from './commands/create-user/create-user.http.controller';
import { CreateUserService } from './commands/create-user/create-user.service';
import { DeactivateUserHttpController } from './commands/deactivate-user/deactivate-user.http.controller';
import { DeactivateUserService } from './commands/deactivate-user/deactivate-user.service';
import { LoginHttpController } from './commands/login/login.http.controller';
import { LoginService } from './commands/login/login.service';
import { ReactivateUserHttpController } from './commands/reactivate-user/reactivate-user.http.controller';
import { ReactivateUserService } from './commands/reactivate-user/reactivate-user.service';
import { RefreshTokenHttpController } from './commands/refresh-token/refresh-token.http.controller';
import { RefreshTokenService } from './commands/refresh-token/refresh-token.service';
import { ResetPasswordHttpController } from './commands/reset-password/reset-password.http.controller';
import { ResetPasswordService } from './commands/reset-password/reset-password.service';
import { StaffUserMapper } from './database/staff-user.mapper';
import { StaffUserRepository } from './database/staff-user.repository';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ListUsersHttpController } from './queries/list-users/list-users.http.controller';
import { ListUsersQueryHandler } from './queries/list-users/list-users.query-handler';
import { MeHttpController } from './queries/me/me.http.controller';
import { MeQueryHandler } from './queries/me/me.query-handler';
import './identity.policies';

@Module({
  imports: [CqrsModule, JwtModule.register({ global: true })],
  controllers: [
    LoginHttpController,
    RefreshTokenHttpController,
    MeHttpController,
    CreateUserHttpController,
    DeactivateUserHttpController,
    ReactivateUserHttpController,
    ResetPasswordHttpController,
    ListUsersHttpController,
  ],
  providers: [
    StaffUserMapper,
    TokenService,
    LoginService,
    RefreshTokenService,
    CreateUserService,
    DeactivateUserService,
    ReactivateUserService,
    ResetPasswordService,
    MeQueryHandler,
    ListUsersQueryHandler,
    { provide: STAFF_USER_REPOSITORY, useClass: StaffUserRepository },
    // Guard order matters: authentication first, then ABAC policy evaluation.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PoliciesGuard },
  ],
})
export class IdentityModule {}
