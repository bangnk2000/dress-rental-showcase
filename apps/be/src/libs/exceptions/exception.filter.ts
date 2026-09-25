import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { BusinessOutcomeException } from './business-outcome.exception';
import { ErrorDetail, ExceptionBase } from './exception.base';
import {
  ArgumentInvalidException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from './exceptions';

const STATUS_BY_TYPE: Array<[new (...args: never[]) => ExceptionBase, HttpStatus]> = [
  [ArgumentInvalidException, HttpStatus.BAD_REQUEST],
  [NotFoundException, HttpStatus.NOT_FOUND],
  [ConflictException, HttpStatus.CONFLICT],
  [ForbiddenException, HttpStatus.FORBIDDEN],
  [UnauthorizedException, HttpStatus.UNAUTHORIZED],
  [ServiceUnavailableException, HttpStatus.SERVICE_UNAVAILABLE],
];

/**
 * The wire has exactly TWO non-success shapes and this filter is the only place that renders
 * them (docs/adr/0001-outcome-model-at-the-http-boundary.md §2):
 *
 * 1. outcome body   `{ status, ...payload }`      — BusinessOutcomeException, passed through
 * 2. error envelope `{ error: { code, message, details?, correlationId } }` — everything else
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const correlationId = (req.headers['x-request-id'] as string) ?? undefined;

    // 1. Business outcome: the controller already shaped the body; do not wrap it.
    if (exception instanceof BusinessOutcomeException) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    // 2. Our own technical exceptions -> envelope with their stable code.
    if (exception instanceof ExceptionBase) {
      const status =
        STATUS_BY_TYPE.find(([type]) => exception instanceof type)?.[1] ??
        HttpStatus.INTERNAL_SERVER_ERROR;
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        res.status(status).json({
          error: { code: 'GENERIC.INTERNAL', message: 'Internal server error', correlationId },
        });
        return;
      }
      res.status(status).json({ error: { ...exception.toJSON(), correlationId } });
      return;
    }

    // 3. Nest built-ins — notably ValidationPipe's BadRequestException. Without this branch a
    //    validation failure would fall through to a 500.
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as { message?: unknown }).message;
      const details: ErrorDetail[] | undefined = Array.isArray(message)
        ? message.map((entry) => ({ message: String(entry) }))
        : undefined;
      res.status(exception.getStatus()).json({
        error: {
          code:
            exception instanceof BadRequestException ? 'GENERIC.VALIDATION' : 'GENERIC.HTTP',
          message: details
            ? 'Validation failed'
            : typeof message === 'string'
              ? message
              : exception.message,
          ...(details && { details }),
          correlationId,
        },
      });
      return;
    }

    // 4. Unknown: 500 with internals hidden.
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'GENERIC.INTERNAL', message: 'Internal server error', correlationId },
    });
  }
}
