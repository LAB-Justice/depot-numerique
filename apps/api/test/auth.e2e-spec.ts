import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from '@depot-numerique/database';
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap/configure-app';
import { DatabaseService } from './../src/core/database/database.service';

interface VerificationRecord extends Record<string, unknown> {
  expiresAt: Date;
  id: string;
  identifier: string;
  value: string;
}

type PrismaWhere = Record<string, unknown>;

function matchesField(actual: unknown, condition: unknown): boolean {
  if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
    const operators = condition as Record<string, unknown>;

    if ('equals' in operators) {
      return actual === operators.equals;
    }

    if ('not' in operators) {
      return !matchesField(actual, operators.not);
    }
  }

  return actual === condition;
}

function matchesWhere(record: VerificationRecord, where: PrismaWhere): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (field === 'AND' && Array.isArray(condition)) {
      return condition.every((entry) => matchesWhere(record, entry as PrismaWhere));
    }

    if (field === 'OR' && Array.isArray(condition)) {
      return condition.some((entry) => matchesWhere(record, entry as PrismaWhere));
    }

    return matchesField(record[field], condition);
  });
}

function createVerificationDatabase() {
  const records = new Map<string, VerificationRecord>();
  const authVerification = {
    create: jest.fn(
      async ({ data }: { data: Omit<VerificationRecord, 'id'> & { id?: string } }) => {
        const record = {
          ...data,
          id: data.id ?? randomUUID(),
        } as VerificationRecord;
        records.set(record.id, record);
        return record;
      },
    ),
    delete: jest.fn(async ({ where }: { where: PrismaWhere }) => {
      const record = [...records.values()].find((candidate) => matchesWhere(candidate, where));
      if (!record) {
        throw Object.assign(new Error('Record not found'), { code: 'P2025' });
      }

      records.delete(record.id);
      return record;
    }),
    deleteMany: jest.fn(async ({ where }: { where: PrismaWhere }) => {
      const matchingRecords = [...records.values()].filter((record) => matchesWhere(record, where));
      for (const record of matchingRecords) {
        records.delete(record.id);
      }

      return { count: matchingRecords.length };
    }),
    findFirst: jest.fn(
      async ({ where }: { where: PrismaWhere }) =>
        [...records.values()].find((record) => matchesWhere(record, where)) ?? null,
    ),
    findMany: jest.fn(
      async ({
        skip = 0,
        take = 100,
        where,
      }: {
        skip?: number;
        take?: number;
        where: PrismaWhere;
      }) =>
        [...records.values()]
          .filter((record) => matchesWhere(record, where))
          .slice(skip, skip + take),
    ),
  };
  const client: Record<string, unknown> = { authVerification };
  client.$transaction = async (callback: (transaction: typeof client) => Promise<unknown>) =>
    callback(client);

  return {
    client: client as unknown as DatabaseClient,
    records,
  };
}

describe('SAML service provider integration (e2e)', () => {
  let app: INestApplication<App>;
  const verificationDatabase = createVerificationDatabase();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({ client: verificationDatabase.client })
      .compile();

    app = moduleFixture.createNestApplication({
      bodyParser: false,
    });
    configureApp(app);

    await app.init();
  });

  beforeEach(() => {
    verificationDatabase.records.clear();
  });

  it('should expose the signed and encrypted service provider metadata', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/sso/saml2/sp/metadata')
      .query({ format: 'xml', providerId: 'justice-saml' })
      .expect('Content-Type', /xml/)
      .expect(200);

    expect(response.text).toContain('entityID="depot-numerique"');
    expect(response.text).toContain('AuthnRequestsSigned="true"');
    expect(response.text).toContain('<md:KeyDescriptor use="signing">');
    expect(response.text).toContain('<md:KeyDescriptor use="encryption">');
    expect(response.text).toContain(
      'SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"',
    );
    expect(response.text).toContain(
      'Location="http://localhost:4200/api/auth/sso/saml2/sp/acs/justice-saml"',
    );
  });

  it('should initiate SSO through a hardened one-time HTTP-POST bridge', async () => {
    const signInResponse = await request(app.getHttpServer())
      .post('/api/auth/sign-in/sso')
      .set('Origin', 'http://localhost:4200')
      .send({
        callbackURL: 'http://localhost:4200/',
        errorCallbackURL: 'http://localhost:4200/',
        providerType: 'saml',
      })
      .expect(200);

    expect(signInResponse.body).toMatchObject({
      redirect: true,
      url: expect.stringMatching(
        /^http:\/\/localhost:4200\/api\/auth\/sso\/saml2\/sp\/post\/[A-Za-z0-9_-]+$/,
      ),
    });

    const bridgePath = new URL(signInResponse.body.url as string).pathname;
    const identifiersAfterSignIn = [...verificationDatabase.records.values()].map(
      (record) => record.identifier,
    );
    expect(identifiersAfterSignIn).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^saml-authn-request:/),
        expect.stringMatching(/^saml-post-request:/),
      ]),
    );

    const bridgeResponse = await request(app.getHttpServer()).get(bridgePath).expect(200);
    const contentSecurityPolicy = bridgeResponse.headers['content-security-policy'] as string;
    const nonce = /script-src 'nonce-([^']+)'/.exec(contentSecurityPolicy)?.[1];

    expect(bridgeResponse.headers['cache-control']).toBe('no-store');
    expect(bridgeResponse.headers['referrer-policy']).toBe('no-referrer');
    expect(bridgeResponse.headers['x-content-type-options']).toBe('nosniff');
    expect(contentSecurityPolicy).toContain("default-src 'none'");
    expect(contentSecurityPolicy).toContain('form-action https://idp.example.test');
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(nonce).toBeDefined();
    expect(bridgeResponse.text).toContain(
      'action="https://idp.example.test/realms/depot-numerique/protocol/saml"',
    );
    expect(bridgeResponse.text).toContain('name="SAMLRequest"');
    expect(bridgeResponse.text).toContain(`<script nonce="${nonce}">`);
    expect(bridgeResponse.text).not.toContain('onload=');

    const identifiersAfterBridge = [...verificationDatabase.records.values()].map(
      (record) => record.identifier,
    );
    expect(
      identifiersAfterBridge.some((identifier) => identifier.startsWith('saml-authn-request:')),
    ).toBe(true);
    expect(
      identifiersAfterBridge.some((identifier) => identifier.startsWith('saml-post-request:')),
    ).toBe(false);

    await request(app.getHttpServer()).get(bridgePath).expect(400);
  });

  it('should reject and remove an expired HTTP-POST bridge token', async () => {
    const signInResponse = await request(app.getHttpServer())
      .post('/api/auth/sign-in/sso')
      .set('Origin', 'http://localhost:4200')
      .send({
        callbackURL: 'http://localhost:4200/',
        errorCallbackURL: 'http://localhost:4200/',
        providerType: 'saml',
      })
      .expect(200);
    const bridgePath = new URL(signInResponse.body.url as string).pathname;
    const bridgeRecord = [...verificationDatabase.records.values()].find((record) =>
      record.identifier.startsWith('saml-post-request:'),
    );

    expect(bridgeRecord).toBeDefined();
    if (!bridgeRecord) {
      throw new Error('The SAML POST bridge record was not created.');
    }
    bridgeRecord.expiresAt = new Date(0);

    await request(app.getHttpServer()).get(bridgePath).expect(400);

    expect(
      [...verificationDatabase.records.values()].some((record) =>
        record.identifier.startsWith('saml-post-request:'),
      ),
    ).toBe(false);
  });

  afterAll(async () => {
    await app.close();
  });
});
