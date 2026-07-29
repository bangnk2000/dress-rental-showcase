import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './libs/exceptions';

/** Shared by main.ts AND scripts/emit-openapi.ts so /docs and the contract never diverge. */
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('dress-rental API')
    // Fixed version: the contract's identity is its git history, not a semver field.
    .setVersion('0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config, {
    // Pinned: Orval derives FE hook names from operationIds — renames are breaking changes.
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  });
}
