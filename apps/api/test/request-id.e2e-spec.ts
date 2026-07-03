import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap/configure-app';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Request ID (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);

    await app.init();
  });

  it('should generate a request ID when none is provided', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1').expect(200);

    expect(response.headers['x-request-id']).toMatch(UUID_PATTERN);
  });

  it('should preserve a valid request ID', async () => {
    const requestId = 'gateway-request_123';

    const response = await request(app.getHttpServer())
      .get('/api/v1')
      .set('X-Request-Id', requestId)
      .expect(200);

    expect(response.headers['x-request-id']).toBe(requestId);
  });

  it('should replace an invalid request ID', async () => {
    const invalidRequestId = 'invalid request id';

    const response = await request(app.getHttpServer())
      .get('/api/v1')
      .set('X-Request-Id', invalidRequestId)
      .expect(200);

    expect(response.headers['x-request-id']).not.toBe(invalidRequestId);
    expect(response.headers['x-request-id']).toMatch(UUID_PATTERN);
  });

  afterAll(async () => {
    await app.close();
  });
});
