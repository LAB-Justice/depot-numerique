import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('WORKER_PORT') ?? 3001;
  await app.listen(port);
  Logger.log(`Worker listening on port ${port}`, 'Bootstrap');
}
bootstrap();
