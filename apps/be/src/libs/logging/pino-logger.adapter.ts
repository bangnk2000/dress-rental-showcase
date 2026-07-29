import { Injectable } from '@nestjs/common';
import pino, { Logger } from 'pino';
import { LoggerPort } from '../ports/logger.port';

@Injectable()
export class PinoLoggerAdapter implements LoggerPort {
  private readonly logger: Logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: ['req.headers.authorization', '*.password', '*.passwordHash'],
  });

  log(message: string, ...meta: unknown[]): void {
    this.logger.info({ meta }, message);
  }

  error(message: string, trace?: unknown, ...meta: unknown[]): void {
    this.logger.error({ trace, meta }, message);
  }

  warn(message: string, ...meta: unknown[]): void {
    this.logger.warn({ meta }, message);
  }

  debug(message: string, ...meta: unknown[]): void {
    this.logger.debug({ meta }, message);
  }
}
