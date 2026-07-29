import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp, createOpenApiDocument } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const config = app.get(ConfigService);
  if (config.get('NODE_ENV') !== 'production') {
    SwaggerModule.setup('docs', app, createOpenApiDocument(app));
  }

  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap();
