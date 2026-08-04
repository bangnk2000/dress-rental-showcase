import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SubjectAttributes } from './authz.types';

/** Injects the verified JWT subject without coupling another context to identity internals. */
export const CurrentSubject = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SubjectAttributes => {
    const request = ctx.switchToHttp().getRequest<{ user: SubjectAttributes }>();
    return request.user;
  },
);
