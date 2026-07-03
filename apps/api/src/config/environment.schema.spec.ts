import { environmentSchema } from './environment.schema';

const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_HOST: 'localhost',
  REDIS_PASSWORD: 'password',
  MINIO_ENDPOINT: 'localhost',
  MINIO_ACCESS_KEY: 'test',
  MINIO_SECRET_KEY: 'test',
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
});
