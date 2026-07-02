import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export function createDatabaseClient(databaseUrl: string): PrismaClient {
  if (!databaseUrl.trim()) {
    throw new Error('DATABASE_URL is required to initialize Prisma');
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
    }),
  });
}

export type DatabaseClient = PrismaClient;
