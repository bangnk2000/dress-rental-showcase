import { ArgumentsHost, BadRequestException, ForbiddenException as NestForbidden } from '@nestjs/common';
import { BusinessOutcomeException } from './business-outcome.exception';
import { GlobalExceptionFilter } from './exception.filter';
import { ExceptionBase } from './exception.base';
import { ConflictException, NotFoundException } from './exceptions';

/** The wire has exactly two non-success shapes — ADR 0001 §2. This proves the filter renders both. */
function makeHost(headers: Record<string, string> = {}): {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ headers }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

class UnmappedException extends ExceptionBase {
  readonly code = 'CUSTOM.UNMAPPED';
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  it('passes a business outcome body through untouched — no error envelope', () => {
    const { host, status, json } = makeHost({ 'x-request-id': 'req-1' });

    filter.catch(
      new BusinessOutcomeException({ status: 'rejected_dress_unavailable', dressIds: ['d1'] }),
      host,
    );

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({
      status: 'rejected_dress_unavailable',
      dressIds: ['d1'],
    });
    // The outcome is a RESULT, so it carries no correlationId and no `error` wrapper.
    expect(json.mock.calls[0][0]).not.toHaveProperty('error');
  });

  it('renders a named denial outcome at its own status', () => {
    const { host, status, json } = makeHost();

    filter.catch(new BusinessOutcomeException({ status: 'forbidden', reason: 'not_owner' }, 403), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ status: 'forbidden', reason: 'not_owner' });
  });

  it.each([
    [new NotFoundException('Dress not found'), 404, 'GENERIC.NOT_FOUND'],
    [new ConflictException('constraint'), 409, 'GENERIC.CONFLICT'],
  ])('wraps a technical exception in the envelope', (exception, expectedStatus, expectedCode) => {
    const { host, status, json } = makeHost({ 'x-request-id': 'req-2' });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(expectedStatus);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: expectedCode,
        message: (exception as Error).message,
        correlationId: 'req-2',
      },
    });
  });

  it('turns ValidationPipe messages into GENERIC.VALIDATION with details[]', () => {
    const { host, status, json } = makeHost();

    filter.catch(new BadRequestException(['code must not be empty', 'price must be >= 0']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'GENERIC.VALIDATION',
        message: 'Validation failed',
        details: [{ message: 'code must not be empty' }, { message: 'price must be >= 0' }],
        correlationId: undefined,
      },
    });
  });

  it('renders other Nest HttpExceptions as GENERIC.HTTP', () => {
    const { host, status, json } = makeHost();

    filter.catch(new NestForbidden('Forbidden resource'), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json.mock.calls[0][0].error.code).toBe('GENERIC.HTTP');
  });

  it('hides internals for unknown throws and for unmapped ExceptionBase subclasses', () => {
    const unknown = makeHost({ 'x-request-id': 'req-3' });
    filter.catch(new Error('pool exhausted at 10.0.0.4:5432'), unknown.host);
    expect(unknown.status).toHaveBeenCalledWith(500);
    expect(unknown.json).toHaveBeenCalledWith({
      error: { code: 'GENERIC.INTERNAL', message: 'Internal server error', correlationId: 'req-3' },
    });

    const unmapped = makeHost();
    filter.catch(new UnmappedException('leaky detail'), unmapped.host);
    expect(unmapped.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(unmapped.json.mock.calls[0][0])).not.toContain('leaky detail');
  });
});
