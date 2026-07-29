import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SubjectAttributes } from '../../../libs/authz/authz.types';

/** Injects the authenticated subject (set by JwtAuthGuard) into a controller parameter. */
export const CurrentSubject = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SubjectAttributes => {
    const request = ctx.switchToHttp().getRequest<{ user: SubjectAttributes }>();
    return request.user;
  },
);
