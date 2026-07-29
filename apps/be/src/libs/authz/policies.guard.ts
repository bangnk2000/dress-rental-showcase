import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ForbiddenException } from '../exceptions';
import { PermissionKey, SubjectAttributes } from './authz.types';
import { evaluatePolicy } from './policy-registry';
import { PERMISSION_KEY } from './require-permission.decorator';

/**
 * Runs AFTER the auth guard (which sets request.user). Endpoints without
 * @RequirePermission need authentication only; endpoints with it are evaluated
 * against the policy registry (fail-closed).
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<PermissionKey | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: SubjectAttributes }>();
    const subject = request.user;
    if (!subject) throw new ForbiddenException(`No subject for permission '${permission}'`);

    const allowed = evaluatePolicy(permission, {
      subject,
      resource: { ...request.params },
    });
    if (!allowed) {
      throw new ForbiddenException(`Permission denied: ${permission}`);
    }
    return true;
  }
}
