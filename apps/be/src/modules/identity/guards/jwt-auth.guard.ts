import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { SubjectAttributes, StaffRole } from '../../../libs/authz/authz.types';
import { UnauthorizedException } from '../../../libs/exceptions';
import { IS_PUBLIC_KEY } from './public.decorator';

interface AccessTokenPayload {
  sub: string;
  role: StaffRole;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: SubjectAttributes }>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      request.user = { staffId: payload.sub, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
