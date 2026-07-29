import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ExceptionBase } from './exception.base';
import {
  ArgumentInvalidException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from './exceptions';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const correlationId = (req.headers['x-request-id'] as string) ?? undefined;

    // Nest's own HttpExceptions (ValidationPipe 400s, 404 routes) pass through unchanged.
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      res
        .status(exception.getStatus())
        .json(typeof body === 'string' ? { message: body, correlationId } : body);
      return;
    }

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    if (exception instanceof ArgumentInvalidException) status = HttpStatus.BAD_REQUEST;
    else if (exception instanceof NotFoundException) status = HttpStatus.NOT_FOUND;
    else if (exception instanceof ConflictException) status = HttpStatus.CONFLICT;
    else if (exception instanceof UnauthorizedException) status = HttpStatus.UNAUTHORIZED;
    else if (exception instanceof ForbiddenException) status = HttpStatus.FORBIDDEN;

    const body =
      exception instanceof ExceptionBase && status !== HttpStatus.INTERNAL_SERVER_ERROR
        ? { ...exception.toJSON(), correlationId }
        : { message: 'Internal server error', code: 'GENERIC.INTERNAL', correlationId };

    res.status(status).json(body);
  }
}
