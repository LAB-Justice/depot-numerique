import { Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicator: HealthIndicatorService,
    private readonly redis: RedisService,
  ) {}

  async isHealthy<Key extends string>(key: Key): Promise<HealthIndicatorResult<Key>> {
    const indicator = this.healthIndicator.check(key);

    try {
      const response = await this.redis.client.ping();

      return response === 'PONG' ? indicator.up() : indicator.down();
    } catch {
      return indicator.down();
    }
  }
}
