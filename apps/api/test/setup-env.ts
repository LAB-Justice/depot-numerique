process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.API_PORT = '3000';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'password';

process.env.MINIO_ENDPOINT = 'localhost';
process.env.MINIO_PORT = '9000';
process.env.MINIO_USE_SSL = 'false';
process.env.MINIO_ACCESS_KEY = 'root';
process.env.MINIO_SECRET_KEY = 'password';
process.env.MINIO_RAW_BUCKET = 'documents-raw';

process.env.BETTER_AUTH_URL = 'http://localhost:4200';
process.env.BETTER_AUTH_SECRET = 'test-secret-with-at-least-32-characters';
process.env.BETTER_AUTH_WEB_ORIGIN = 'http://localhost:4200';
