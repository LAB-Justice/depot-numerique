import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule as NestBetterAuthModule } from '@thallesp/nestjs-better-auth';
import { DatabaseModule } from '../core/database/database.module';
import { DatabaseService } from '../core/database/database.service';
import { createAuth } from './auth';

@Module({
  imports: [
    NestBetterAuthModule.forRootAsync({
      imports: [ConfigModule, DatabaseModule],
      inject: [ConfigService, DatabaseService],
      useFactory: (config: ConfigService, database: DatabaseService) => ({
        auth: createAuth({
          baseUrl: config.getOrThrow<string>('BETTER_AUTH_URL'),
          database: database.client,
          secret: config.getOrThrow<string>('BETTER_AUTH_SECRET'),
          webOrigin: config.getOrThrow<string>('BETTER_AUTH_WEB_ORIGIN'),
        }),
      }),
      disableGlobalAuthGuard: true,
    }),
  ],
})
export class AuthentificationModule {}
