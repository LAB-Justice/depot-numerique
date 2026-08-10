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

const TEST_IDP_METADATA = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" />
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
