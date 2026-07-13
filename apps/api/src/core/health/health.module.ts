import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { StorageModule } from '../storage/storage.module';
import { HealthController } from './health.controller';
import { MinioHealthIndicator } from './minio.health-indicator';
import { RedisHealthIndicator } from './redis.health-indicator';

@Module({
  imports: [
    TerminusModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        logger: config.getOrThrow<string>('NODE_ENV') !== 'test',
      }),
    }),
    DatabaseModule,
    RedisModule,
    StorageModule,
  ],
  providers: [RedisHealthIndicator, MinioHealthIndicator],
  controllers: [HealthController],
})
export class HealthModule {}
