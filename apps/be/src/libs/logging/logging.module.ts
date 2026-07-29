import { Global, Module } from '@nestjs/common';
import { LOGGER_PORT } from '../ports/logger.port';
import { PinoLoggerAdapter } from './pino-logger.adapter';

@Global()
@Module({
  providers: [{ provide: LOGGER_PORT, useClass: PinoLoggerAdapter }],
  exports: [LOGGER_PORT],
})
export class LoggingModule {}
