import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule as NestBetterAuthModule } from '@thallesp/nestjs-better-auth';
import { DatabaseModule } from '../core/database/database.module';
import { DatabaseService } from '../core/database/database.service';
import { createAuth } from './auth';
import { loadSamlMetadata } from './saml-metadata.loader';
import { loadSamlSpCredentials } from './saml-sp-credentials';
import { createSamlSpMetadata } from './saml-sp-metadata';

@Module({
  imports: [
    NestBetterAuthModule.forRootAsync({
      imports: [ConfigModule, DatabaseModule],
      inject: [ConfigService, DatabaseService],
      useFactory: async (config: ConfigService, database: DatabaseService) => {
        const idpMetadataUrl = config.getOrThrow<string>('SSO_IDP_METADATA_URL');
        const environment = config.getOrThrow<string>('NODE_ENV');
        const baseUrl = config.getOrThrow<string>('BETTER_AUTH_URL');
        const providerId = config.getOrThrow<string>('SSO_PROVIDER_ID');
        const spEntityId = config.getOrThrow<string>('SSO_SP_ENTITY_ID');
        const [idpMetadata, credentials] = await Promise.all([
          loadSamlMetadata({
            environment,
            url: idpMetadataUrl,
          }),
          loadSamlSpCredentials(
            {
              encryptionCertificatePath: config.getOrThrow<string>(
                'SSO_SP_ENCRYPTION_CERTIFICATE_PATH',
              ),
              encryptionPrivateKeyPath: config.getOrThrow<string>(
                'SSO_SP_ENCRYPTION_PRIVATE_KEY_PATH',
              ),
              signingCertificatePath: config.getOrThrow<string>('SSO_SP_SIGNING_CERTIFICATE_PATH'),
              signingPrivateKeyPath: config.getOrThrow<string>('SSO_SP_SIGNING_PRIVATE_KEY_PATH'),
            },
            environment,
          ),
        ]);
        const spMetadata = createSamlSpMetadata({
          baseUrl,
          entityId: spEntityId,
          providerId,
          encryptionCertificateBase64: credentials.encryptionCertificateBase64,
          signingCertificateBase64: credentials.signingCertificateBase64,
        });

        return {
          auth: createAuth({
            baseUrl,
            database: database.client,
            secret: config.getOrThrow<string>('BETTER_AUTH_SECRET'),
            sso: {
              domain: config.getOrThrow<string>('SSO_DOMAIN'),
              encryptionPrivateKey: credentials.encryptionPrivateKey,
              signingPrivateKey: credentials.signingPrivateKey,
              providerId,
              idpMetadata,
              idpMetadataUrl,
              spEntityId,
              spMetadata,
            },
            webOrigin: config.getOrThrow<string>('BETTER_AUTH_WEB_ORIGIN'),
          }),
        };
      },
      disableGlobalAuthGuard: false,
    }),
  ],
})
export class AuthentificationModule {}
