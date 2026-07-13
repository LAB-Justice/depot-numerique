import type { INestApplication } from '@nestjs/common';
import { PrismaHealthIndicator } from '@nestjs/terminus';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap/configure-app';
import { MinioHealthIndicator } from './../src/core/health/minio.health-indicator';
import { RedisHealthIndicator } from './../src/core/health/redis.health-indicator';

const prismaHealthIndicator = {
  pingCheck: jest.fn(),
};

const redisHealthIndicator = {
  isHealthy: jest.fn(),
};

const minioHealthIndicator = {
  isHealthy: jest.fn(),
};

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaHealthIndicator)
      .useValue(prismaHealthIndicator)
      .overrideProvider(RedisHealthIndicator)
      .useValue(redisHealthIndicator)
      .overrideProvider(MinioHealthIndicator)
      .useValue(minioHealthIndicator)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);

    await app.init();
  });

  beforeEach(() => {
    prismaHealthIndicator.pingCheck.mockReset();
    redisHealthIndicator.isHealthy.mockReset();
    minioHealthIndicator.isHealthy.mockReset();
  });

  it('/api/health/live (GET) should report the API as alive', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/live').expect(200);

    expect(prismaHealthIndicator.pingCheck).not.toHaveBeenCalled();
    expect(redisHealthIndicator.isHealthy).not.toHaveBeenCalled();
    expect(minioHealthIndicator.isHealthy).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      status: 'ok',
      info: {},
      error: {},
      details: {},
    });
  });

  it('/api/v1/health/live (GET) should not version the health route', () => {
    return request(app.getHttpServer()).get('/api/v1/health/live').expect(404);
  });

  it('/api/health/ready (GET) should report all dependencies as available', async () => {
    prismaHealthIndicator.pingCheck.mockResolvedValueOnce({
      postgresql: {
        status: 'up',
      },
    });
    redisHealthIndicator.isHealthy.mockResolvedValueOnce({
      redis: {
        status: 'up',
      },
    });
    minioHealthIndicator.isHealthy.mockResolvedValueOnce({
      minio: {
        status: 'up',
      },
    });

    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      info: {
        postgresql: {
          status: 'up',
        },
        redis: {
          status: 'up',
        },
        minio: {
          status: 'up',
        },
      },
      error: {},
      details: {
        postgresql: {
          status: 'up',
        },
        redis: {
          status: 'up',
        },
        minio: {
          status: 'up',
        },
      },
    });

    expect(prismaHealthIndicator.pingCheck).toHaveBeenCalledWith('postgresql', expect.anything(), {
      timeout: 1000,
    });
    expect(redisHealthIndicator.isHealthy).toHaveBeenCalledWith('redis');
    expect(minioHealthIndicator.isHealthy).toHaveBeenCalledWith('minio');
  });

  it('/api/health/ready (GET) should report PostgreSQL as unavailable', async () => {
    prismaHealthIndicator.pingCheck.mockResolvedValueOnce({
      postgresql: {
        status: 'down',
      },
    });
    redisHealthIndicator.isHealthy.mockResolvedValueOnce({
      redis: {
        status: 'up',
      },
    });
    minioHealthIndicator.isHealthy.mockResolvedValueOnce({
      minio: {
        status: 'up',
      },
    });

    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(503);

    expect(response.body).toEqual({
      status: 'error',
      info: {
        redis: {
          status: 'up',
        },
        minio: {
          status: 'up',
        },
      },
      error: {
        postgresql: {
          status: 'down',
        },
      },
      details: {
        postgresql: {
          status: 'down',
        },
        redis: {
          status: 'up',
        },
        minio: {
          status: 'up',
        },
      },
    });
  });

  it('/api/health/ready (GET) should report Redis as unavailable', async () => {
    prismaHealthIndicator.pingCheck.mockResolvedValueOnce({
      postgresql: {
        status: 'up',
      },
    });
    redisHealthIndicator.isHealthy.mockResolvedValueOnce({
      redis: {
        status: 'down',
      },
    });
    minioHealthIndicator.isHealthy.mockResolvedValueOnce({
      minio: {
        status: 'up',
      },
    });

    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(503);

    expect(response.body).toEqual({
      status: 'error',
      info: {
        postgresql: {
          status: 'up',
        },
        minio: {
          status: 'up',
        },
      },
      error: {
        redis: {
          status: 'down',
        },
      },
      details: {
        postgresql: {
          status: 'up',
        },
        redis: {
          status: 'down',
        },
        minio: {
          status: 'up',
        },
      },
    });
  });

  it('/api/health/ready (GET) should report MinIO as unavailable', async () => {
    prismaHealthIndicator.pingCheck.mockResolvedValueOnce({
      postgresql: {
        status: 'up',
      },
    });
    redisHealthIndicator.isHealthy.mockResolvedValueOnce({
      redis: {
        status: 'up',
      },
    });
    minioHealthIndicator.isHealthy.mockResolvedValueOnce({
      minio: {
        status: 'down',
      },
    });

    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(503);

    expect(response.body).toEqual({
      status: 'error',
      info: {
        postgresql: {
          status: 'up',
        },
        redis: {
          status: 'up',
        },
      },
      error: {
        minio: {
          status: 'down',
        },
      },
      details: {
        postgresql: {
          status: 'up',
        },
        redis: {
          status: 'up',
        },
        minio: {
          status: 'down',
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
