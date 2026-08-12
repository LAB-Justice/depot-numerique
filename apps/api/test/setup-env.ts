import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

process.env.SSO_PROVIDER_ID = 'justice-saml';
process.env.SSO_DOMAIN = 'justice.fr';
process.env.SSO_SP_ENTITY_ID = 'depot-numerique';
process.env.SSO_IDP_METADATA_URL =
  'http://localhost:8080/realms/depot-numerique/protocol/saml/descriptor';
process.env.SSO_SP_SIGNING_PRIVATE_KEY_PATH = resolve(
  process.cwd(),
  '../../.secrets/saml/sp-signing-private-key.pem',
);
process.env.SSO_SP_SIGNING_CERTIFICATE_PATH = resolve(
  process.cwd(),
  '../../.secrets/saml/sp-signing-certificate.pem',
);
process.env.SSO_SP_ENCRYPTION_PRIVATE_KEY_PATH = resolve(
  process.cwd(),
  '../../.secrets/saml/sp-encryption-private-key.pem',
);
process.env.SSO_SP_ENCRYPTION_CERTIFICATE_PATH = resolve(
  process.cwd(),
  '../../.secrets/saml/sp-encryption-certificate.pem',
);

const TEST_IDP_CERTIFICATE = readFileSync(process.env.SSO_SP_SIGNING_CERTIFICATE_PATH, 'utf8')
  .replace('-----BEGIN CERTIFICATE-----', '')
  .replace('-----END CERTIFICATE-----', '')
  .replaceAll(/\s/g, '');

const TEST_IDP_METADATA = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" entityID="https://idp.example.test/realms/depot-numerique">
  <md:IDPSSODescriptor WantAuthnRequestsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${TEST_IDP_CERTIFICATE}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://idp.example.test/realms/depot-numerique/protocol/saml" />
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified</md:NameIDFormat>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://idp.example.test/realms/depot-numerique/protocol/saml" />
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;

const nativeFetch = globalThis.fetch;

globalThis.fetch = ((input, init) => {
  if (input.toString() === process.env.SSO_IDP_METADATA_URL) {
    return Promise.resolve(
      new Response(TEST_IDP_METADATA, {
        headers: { 'content-type': 'application/xml' },
        status: 200,
      }),
    );
  }

  return nativeFetch(input, init);
}) as typeof fetch;
