import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp, createOpenApiDocument } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  // Trust X-Forwarded-For ONLY from a loopback hop (the nginx on this VPS): `req.ip` is then the
  // real client, which is what the `/public/*` rate limit keys on. A client-sent header reaching
  // the api directly is ignored, so it cannot spoof its way past the limit.
  app.set('trust proxy', 'loopback');

  const config = app.get(ConfigService);
  if (config.get('NODE_ENV') !== 'production') {
    SwaggerModule.setup('docs', app, createOpenApiDocument(app));
  }

  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap();
