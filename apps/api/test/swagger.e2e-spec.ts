import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap/configure-app';
import { configureSwagger } from './../src/bootstrap/configure-swagger';

describe('Swagger (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    configureApp(app);
    configureSwagger(app);

    await app.init();
  });

  it('/api/docs-json (GET) should expose the OpenAPI contract', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(response.body).toMatchObject({
      info: {
        title: 'Dépôt Numérique API',
        version: '1.0',
      },
      paths: {
        '/api/v1': expect.any(Object),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
