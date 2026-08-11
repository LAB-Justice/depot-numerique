import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { AppModule } from './../src/app.module';
import { AppService } from './../src/app.service';
import { configureApp } from './../src/bootstrap/configure-app';

async function createProtectedApplication() {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication({
    bodyParser: false,
  });
  configureApp(app);
  await app.init();

  return app;
}

async function createControllerApplication() {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [AppController],
    providers: [
      AppService,
      {
        provide: ConfigService,
        useValue: new ConfigService({
          CORS_ALLOWED_ORIGINS: 'http://localhost:4200',
        }),
      },
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();

  return app;
}

describe('Application routing and authentication (e2e)', () => {
  let protectedApp: INestApplication<App>;
  let controllerApp: INestApplication<App>;

  beforeAll(async () => {
    protectedApp = await createProtectedApplication();
    controllerApp = await createControllerApplication();
  });

  it('/api/v1 (GET) should reject an unauthenticated request', () => {
    return request(protectedApp.getHttpServer()).get('/api/v1').expect(401);
  });

  it('/api/v1 (GET) should expose the controller response through the configured HTTP route', () => {
    return request(controllerApp.getHttpServer()).get('/api/v1').expect(200).expect('Hello World!');
  });

  it('/ (GET) should not expose an unversioned route', () => {
    return request(protectedApp.getHttpServer()).get('/').expect(404);
  });

  it('/api/v2 (GET) should reject an unknown version', () => {
    return request(protectedApp.getHttpServer()).get('/api/v2').expect(404);
  });

  afterAll(async () => {
    await Promise.all([protectedApp.close(), controllerApp.close()]);
  });
});
