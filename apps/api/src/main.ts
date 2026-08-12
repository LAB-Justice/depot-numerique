import { Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';
import { configureSwagger } from './bootstrap/configure-swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  app.useLogger(app.get(PinoLogger));

  app.enableShutdownHooks();

  configureApp(app);

  const config = app.get(ConfigService);
  const isProduction = config.getOrThrow<string>('NODE_ENV') === 'production';

  if (!isProduction) {
    configureSwagger(app);
  }

  const port = config.getOrThrow<number>('API_PORT');
  await app.listen(port);
}
void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  NestLogger.error(`API failed to start: ${message}`, stack, 'Bootstrap');
  process.exit(1);
});
