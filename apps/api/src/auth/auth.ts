import type { DatabaseClient } from '@depot-numerique/database';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

export interface CreateAuthOptions {
  baseUrl: string;
  database: DatabaseClient;
  secret: string;
  webOrigin: string;
}

export function createAuth(options: CreateAuthOptions) {
  return betterAuth({
    appName: 'Dépôt Numérique',

    baseURL: options.baseUrl,
    basePath: '/api/auth',

    trustedOrigins: [options.webOrigin],

    database: prismaAdapter(options.database, {
      provider: 'postgresql',
      transaction: true,
    }),

    user: {
      modelName: 'AuthIdentity',
    },

    session: {
      modelName: 'AuthSession',
    },

    account: {
      modelName: 'AuthAccount',
    },

    verification: {
      modelName: 'AuthVerification',
    },

    telemetry: {
      enabled: false,
    },

    secret: options.secret,

    advanced: {
      database: {
        generateId: 'uuid',
      },
    },

    emailAndPassword: {
      enabled: false,
    },
  });
}

export type AppAuth = ReturnType<typeof createAuth>;
