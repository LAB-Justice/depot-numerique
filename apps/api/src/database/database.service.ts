import { createDatabaseClient, type DatabaseClient } from '@depot-numerique/database';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: DatabaseClient;

  constructor(config: ConfigService) {
    const databaseUrl = config.getOrThrow<string>('DATABASE_URL');

    this.client = createDatabaseClient(databaseUrl);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
