import { HealthIndicatorService } from '@nestjs/terminus';
import { Test, type TestingModule } from '@nestjs/testing';
import { RedisService } from '../redis/redis.service';
import { RedisHealthIndicator } from './redis.health-indicator';

const ping = jest.fn();

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;

  beforeEach(async () => {
    ping.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        HealthIndicatorService,
        {
          provide: RedisService,
          useValue: {
            client: {
              ping,
            },
          },
        },
      ],
    }).compile();

    indicator = module.get(RedisHealthIndicator);
  });

  it('should report Redis as up when PING returns PONG', async () => {
    ping.mockResolvedValueOnce('PONG');

    await expect(indicator.isHealthy('redis')).resolves.toEqual({
      redis: {
        status: 'up',
      },
    });

    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('should report Redis as down for an unexpected response', async () => {
    ping.mockResolvedValueOnce('unexpected');

    await expect(indicator.isHealthy('redis')).resolves.toEqual({
      redis: {
        status: 'down',
      },
    });
  });

  it('should report Redis as down when PING fails', async () => {
    ping.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(indicator.isHealthy('redis')).resolves.toEqual({
      redis: {
        status: 'down',
      },
    });
  });
});
