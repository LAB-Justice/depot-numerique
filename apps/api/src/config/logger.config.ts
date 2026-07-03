import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import type { LogLevel } from './environment.schema';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

function resolveRequestId(request: IncomingMessage): string {
  const header = request.headers['x-request-id'];

  if (typeof header === 'string' && REQUEST_ID_PATTERN.test(header)) {
    return header;
  }

  return randomUUID();
}

export function createLoggerConfig(config: ConfigService): Params {
  const level = config.getOrThrow<LogLevel>('LOG_LEVEL');

  return {
    pinoHttp: {
      level,

      genReqId(request, response) {
        const requestId = resolveRequestId(request);

        response.setHeader('X-Request-Id', requestId);

        return requestId;
      },

      customAttributeKeys: {
        reqId: 'requestId',
        responseTime: 'responseTimeMs',
      },

      customLogLevel(_request, response, error) {
        if (error || response.statusCode >= 500) {
          return 'error';
        }

        if (response.statusCode >= 400) {
          return 'warn';
        }

        return 'info';
      },

      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        censor: '[REDACTED]',
      },
    },
  };
}
