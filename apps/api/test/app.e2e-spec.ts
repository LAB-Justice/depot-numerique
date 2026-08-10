import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap/configure-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({
      bodyParser: false,
    });
    configureApp(app);

    await app.init();
  });

  it('/api/v1 (GET) should require a session', () => {
    return request(app.getHttpServer()).get('/api/v1').expect(401);
  });

  it('/ (GET) should not expose an unversioned route', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  it('/api/v2 (GET) should reject an unknown version', () => {
    return request(app.getHttpServer()).get('/api/v2').expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
