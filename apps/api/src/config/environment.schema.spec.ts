import { environmentSchema } from './environment.schema';

const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_HOST: 'localhost',
  REDIS_PASSWORD: 'password',
  MINIO_ENDPOINT: 'localhost',
  MINIO_ACCESS_KEY: 'test',
  MINIO_SECRET_KEY: 'test',
  BETTER_AUTH_URL: 'http://localhost:4200',
  BETTER_AUTH_SECRET: 'test-secret-with-at-least-32-characters',
  BETTER_AUTH_WEB_ORIGIN: 'http://localhost:4200',
  SSO_IDP_METADATA_URL: 'http://localhost:8080/realms/depot-numerique/protocol/saml/descriptor',
} as const;

describe('environmentSchema', () => {
  it('should provide default values', () => {
    const { value, error } = environmentSchema.validate({
      ...REQUIRED_ENV,
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      ...REQUIRED_ENV,
      NODE_ENV: 'development',
      API_PORT: 3000,
      LOG_LEVEL: 'info',
      REDIS_PORT: 6379,
      MINIO_PORT: 9000,
      MINIO_USE_SSL: false,
      MINIO_RAW_BUCKET: 'documents-raw',
      SSO_DOMAIN: 'justice.fr',
      SSO_PROVIDER_ID: 'justice-saml',
      SSO_SP_ENCRYPTION_CERTIFICATE_PATH: '../../.secrets/saml/sp-encryption-certificate.pem',
      SSO_SP_ENCRYPTION_PRIVATE_KEY_PATH: '../../.secrets/saml/sp-encryption-private-key.pem',
      SSO_SP_ENTITY_ID: 'depot-numerique',
      SSO_SP_SIGNING_CERTIFICATE_PATH: '../../.secrets/saml/sp-signing-certificate.pem',
      SSO_SP_SIGNING_PRIVATE_KEY_PATH: '../../.secrets/saml/sp-signing-private-key.pem',
    });
  });

  it('should convert ports to numbers', () => {
    const { value, error } = environmentSchema.validate({
      ...REQUIRED_ENV,
      NODE_ENV: 'test',
      API_PORT: '4000',
      REDIS_PORT: '6380',
      MINIO_PORT: '9001',
      MINIO_USE_SSL: 'true',
    });

    expect(error).toBeUndefined();
    expect(value.API_PORT).toBe(4000);
    expect(value.REDIS_PORT).toBe(6380);
    expect(value.MINIO_PORT).toBe(9001);
    expect(value.MINIO_USE_SSL).toBe(true);
  });

  it('should reject invalid environment', () => {
    const { error } = environmentSchema.validate(
      {
        ...REQUIRED_ENV,
        NODE_ENV: 'invalid',
        API_PORT: 70000,
      },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error?.details).toHaveLength(2);
  });

  it('should reject an invalid log level', () => {
    const { error } = environmentSchema.validate({
      ...REQUIRED_ENV,
      LOG_LEVEL: 'verbose',
    });

    expect(error?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['LOG_LEVEL'],
          type: 'any.only',
        }),
      ]),
    );
  });

  it('should require DATABASE_URL', () => {
    const { error } = environmentSchema.validate({
      REDIS_HOST: REQUIRED_ENV.REDIS_HOST,
      REDIS_PASSWORD: REQUIRED_ENV.REDIS_PASSWORD,
      MINIO_ENDPOINT: REQUIRED_ENV.MINIO_ENDPOINT,
      MINIO_ACCESS_KEY: REQUIRED_ENV.MINIO_ACCESS_KEY,
      MINIO_SECRET_KEY: REQUIRED_ENV.MINIO_SECRET_KEY,
    });

    expect(error?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['DATABASE_URL'],
          type: 'any.required',
        }),
      ]),
    );
  });

  it('should reject an invalid Redis configuration', () => {
    const { error } = environmentSchema.validate(
      {
        ...REQUIRED_ENV,
        REDIS_HOST: 'invalid host',
        REDIS_PASSWORD: '',
      },
      {
        abortEarly: false,
      },
    );

    expect(error?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['REDIS_HOST'],
        }),
        expect.objectContaining({
          path: ['REDIS_PASSWORD'],
        }),
      ]),
    );
  });

  it('should reject an invalid MinIO configuration', () => {
    const { error } = environmentSchema.validate(
      {
        ...REQUIRED_ENV,
        MINIO_ENDPOINT: 'invalid host',
        MINIO_ACCESS_KEY: '',
        MINIO_SECRET_KEY: '',
        MINIO_RAW_BUCKET: 'Invalid_Bucket',
      },
      {
        abortEarly: false,
      },
    );

    expect(error?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['MINIO_ENDPOINT'],
        }),
        expect.objectContaining({
          path: ['MINIO_ACCESS_KEY'],
        }),
        expect.objectContaining({
          path: ['MINIO_SECRET_KEY'],
        }),
        expect.objectContaining({
          path: ['MINIO_RAW_BUCKET'],
        }),
      ]),
    );
  });

  it('should reject an invalid Better Auth configuration', () => {
    const { error } = environmentSchema.validate(
      {
        ...REQUIRED_ENV,
        BETTER_AUTH_URL: 'invalid-url',
        BETTER_AUTH_SECRET: 'too-short',
        BETTER_AUTH_WEB_ORIGIN: 'invalid-origin',
      },
      {
        abortEarly: false,
      },
    );

    expect(error?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['BETTER_AUTH_URL'],
        }),
        expect.objectContaining({
          path: ['BETTER_AUTH_SECRET'],
        }),
        expect.objectContaining({
          path: ['BETTER_AUTH_WEB_ORIGIN'],
        }),
      ]),
    );
  });

  it('should reject an invalid SAML SSO configuration', () => {
    const { error } = environmentSchema.validate(
      {
        ...REQUIRED_ENV,
        SSO_PROVIDER_ID: 'INVALID PROVIDER',
        SSO_DOMAIN: 'invalid domain',
        SSO_SP_ENTITY_ID: '',
        SSO_IDP_METADATA_URL: 'invalid-url',
      },
      {
        abortEarly: false,
      },
    );

    expect(error?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['SSO_PROVIDER_ID'],
        }),
        expect.objectContaining({
          path: ['SSO_DOMAIN'],
        }),
        expect.objectContaining({
          path: ['SSO_SP_ENTITY_ID'],
        }),
        expect.objectContaining({
          path: ['SSO_IDP_METADATA_URL'],
        }),
      ]),
    );
  });
});
