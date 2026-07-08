import Joi from 'joi';

const LOG_LEVELS = ['silent', 'trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  API_PORT: Joi.number().port().default(3000),
  LOG_LEVEL: Joi.string()
    .valid(...LOG_LEVELS)
    .default('info'),
  DATABASE_URL: Joi.string()
    .uri({
      scheme: ['postgresql', 'postgres'],
    })
    .required(),
  REDIS_HOST: Joi.string().hostname().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().min(1).required(),
  MINIO_ENDPOINT: Joi.string().hostname().required(),
  MINIO_PORT: Joi.number().port().default(9000),
  MINIO_USE_SSL: Joi.boolean().default(false),
  MINIO_ACCESS_KEY: Joi.string().min(1).required(),
  MINIO_SECRET_KEY: Joi.string().min(1).required(),
  MINIO_RAW_BUCKET: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/)
    .default('documents-raw'),
  CORS_ALLOWED_ORIGINS: Joi.string().default('http://localhost:4200'),
  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
});
