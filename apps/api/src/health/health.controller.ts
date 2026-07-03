import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  type HealthCheckResult,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { DatabaseService } from '../database/database.service';
import { MinioHealthIndicator } from './minio.health-indicator';
import { RedisHealthIndicator } from './redis.health-indicator';

@Controller({
  path: 'health',
  version: VERSION_NEUTRAL,
})
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly database: DatabaseService,
    private readonly redis: RedisHealthIndicator,
    private readonly minio: MinioHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  liveness(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () =>
        this.prisma.pingCheck('postgresql', this.database.client, {
          timeout: 1000,
        }),
      () => this.redis.isHealthy('redis'),
      () => this.minio.isHealthy('minio'),
    ]);
  }
}
