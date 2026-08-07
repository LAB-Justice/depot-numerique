import { sso } from '@better-auth/sso';
import type { DatabaseClient } from '@depot-numerique/database';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { synchronizeSsoUser } from './sso-user-provisioning';

export interface CreateAuthOptions {
  baseUrl: string;
  database: DatabaseClient;
  secret: string;
  sso: {
    domain: string;
    encryptionPrivateKey: string;
    idpMetadata: string;
    idpMetadataUrl: string;
    providerId: string;
    signingPrivateKey: string;
    spEntityId: string;
    spMetadata: string;
  };
  webOrigin: string;
}

export function createAuth(options: CreateAuthOptions) {
  const callbackUrl = new URL(
    `/api/auth/sso/saml2/sp/acs/${options.sso.providerId}`,
    options.baseUrl,
  ).toString();

  return betterAuth({
    appName: 'Dépôt Numérique',

    baseURL: options.baseUrl,
    basePath: '/api/auth',

    trustedOrigins: [options.webOrigin],

    disabledPaths: [
      '/sso/register',
      '/sso/providers',
      '/sso/update-provider',
      '/sso/delete-provider',
    ],

    database: prismaAdapter(options.database, {
      provider: 'postgresql',
      transaction: true,
    }),

    user: {
      modelName: 'authIdentity',
    },

    session: {
      expiresIn: 6 * 60 * 60,
      disableSessionRefresh: true,
      modelName: 'authSession',
    },

    account: {
      modelName: 'authAccount',
    },

    verification: {
      modelName: 'authVerification',
    },

    telemetry: {
      enabled: false,
    },

    advanced: {
      database: {
        generateId: 'uuid',
      },
    },

    emailAndPassword: {
      enabled: false,
    },

    plugins: [
      sso({
        defaultSSO: [
          {
            providerId: options.sso.providerId,
            domain: options.sso.domain,
            samlConfig: {
              issuer: options.sso.spEntityId,
              entryPoint: options.sso.idpMetadataUrl,
              cert: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
              callbackUrl,
              idpMetadata: {
                isAssertionEncrypted: true,
                metadata: options.sso.idpMetadata,
              },
              spMetadata: {
                entityID: options.sso.spEntityId,
                metadata: options.sso.spMetadata,
                privateKey: options.sso.signingPrivateKey,
                isAssertionEncrypted: true,
                encPrivateKey: options.sso.encryptionPrivateKey,
              },
              mapping: {
                id: 'igcid',
                email: 'mail',
                firstName: 'prenom',
                lastName: 'nom',
                extraFields: {
                  igcId: 'igcid',
                  firstName: 'prenom',
                  lastName: 'nom',
                  logonId: 'logonId',
                  roles: 'roles',
                  bureauIGC: 'bureauIGC',
                  siteDescription: 'siteDescription',
                  affectationOp2: 'affectationOp2',
                  affectationOp3: 'affectationOp3',
                  affectationOp4: 'affectationOp4',
                },
              },
              authnRequestsSigned: true,
              signatureAlgorithm: 'rsa-sha256',
              digestAlgorithm: 'sha256',
              wantAssertionsSigned: true,
            },
          },
        ],
        provisionUser: async ({ user, userInfo }) => {
          await synchronizeSsoUser(options.database, user.id, userInfo);
        },
        provisionUserOnEveryLogin: true,
        providersLimit: 0,
        saml: {
          algorithms: {
            onDeprecated: 'reject',
            signature: 'rsa-sha256',
            digest: 'sha256',
          },
          enableInResponseToValidation: true,
          allowIdpInitiated: false,
          requestTTL: 5 * 60 * 1000,
          clockSkew: 60 * 1000,
          requireTimestamps: true,
          enableSingleLogout: true,
          logoutRequestTTL: 5 * 60 * 1000,
          maxResponseSize: 256 * 1024,
          maxMetadataSize: 100 * 1024,
          wantLogoutRequestSigned: true,
          wantLogoutResponseSigned: true,
        },
        modelName: 'authSsoProvider',
      }),
    ],

    secret: options.secret,
  });
}
