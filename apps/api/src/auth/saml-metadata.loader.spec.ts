import { loadSamlMetadata } from './saml-metadata.loader';

const VALID_METADATA = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" />
</md:EntityDescriptor>`;

function createFetch(response: Response): typeof fetch {
  return jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(response);
}

describe('loadSamlMetadata', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should download valid IdP metadata', async () => {
    const fetchImplementation = createFetch(
      new Response(VALID_METADATA, {
        headers: { 'content-type': 'application/xml' },
        status: 200,
      }),
    );

    await expect(
      loadSamlMetadata({
        environment: 'development',
        fetchImplementation,
        url: 'http://localhost:8080/realms/test/protocol/saml/descriptor',
      }),
    ).resolves.toBe(VALID_METADATA);

    expect(fetchImplementation).toHaveBeenCalledWith(
      new URL('http://localhost:8080/realms/test/protocol/saml/descriptor'),
      expect.objectContaining({
        headers: {
          accept: 'application/samlmetadata+xml, application/xml, text/xml',
        },
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('should require HTTPS in production', async () => {
    const fetchImplementation = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();

    await expect(
      loadSamlMetadata({
        environment: 'production',
        fetchImplementation,
        url: 'http://sso.example.test/metadata',
      }),
    ).rejects.toThrow(/HTTPS en production/);

    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('should reject unsupported URL protocols before making a request', async () => {
    const fetchImplementation = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();

    await expect(
      loadSamlMetadata({
        environment: 'development',
        fetchImplementation,
        url: 'file:///tmp/idp-metadata.xml',
      }),
    ).rejects.toThrow(/protocole HTTP ou HTTPS/);

    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('should reject unsuccessful responses', async () => {
    await expect(
      loadSamlMetadata({
        environment: 'development',
        fetchImplementation: createFetch(new Response(null, { status: 503 })),
        url: 'https://sso.example.test/metadata',
      }),
    ).rejects.toThrow('HTTP 503');
  });

  it('should reject oversized metadata', async () => {
    await expect(
      loadSamlMetadata({
        environment: 'development',
        fetchImplementation: createFetch(new Response(VALID_METADATA)),
        maxSizeBytes: 10,
        url: 'https://sso.example.test/metadata',
      }),
    ).rejects.toThrow(/223 octets > 10 octets/);
  });

  it('should reject an oversized declared content length before reading the body', async () => {
    await expect(
      loadSamlMetadata({
        environment: 'development',
        fetchImplementation: createFetch(
          new Response(VALID_METADATA, {
            headers: { 'content-length': '500' },
          }),
        ),
        maxSizeBytes: 100,
        url: 'https://sso.example.test/metadata',
      }),
    ).rejects.toThrow(/500 octets > 100 octets/);
  });

  it('should reject a response without a body', async () => {
    await expect(
      loadSamlMetadata({
        environment: 'development',
        fetchImplementation: createFetch(new Response(null, { status: 200 })),
        url: 'https://sso.example.test/metadata',
      }),
    ).rejects.toThrow(/ne contient pas de corps/);
  });

  it('should reject metadata that is not valid UTF-8', async () => {
    await expect(
      loadSamlMetadata({
        environment: 'development',
        fetchImplementation: createFetch(new Response(Uint8Array.of(0xc3, 0x28))),
        url: 'https://sso.example.test/metadata',
      }),
    ).rejects.toThrow(/UTF-8 valide/);
  });

  it('should reject documents that are not IdP metadata', async () => {
    await expect(
      loadSamlMetadata({
        environment: 'development',
        fetchImplementation: createFetch(new Response('<html>Not metadata</html>')),
        url: 'https://sso.example.test/metadata',
      }),
    ).rejects.toThrow(/éléments attendus/);
  });

  it('should wrap network failures without exposing their details in the public message', async () => {
    const networkError = new Error('getaddrinfo ENOTFOUND internal-idp');
    const fetchImplementation = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockRejectedValue(networkError);

    const result = loadSamlMetadata({
      environment: 'development',
      fetchImplementation,
      url: 'https://sso.example.test/metadata',
    });

    await expect(result).rejects.toMatchObject({
      cause: networkError,
      message: 'Erreur lors du téléchargement des métadonnées SAML.',
    });
  });

  it('should abort a metadata request after the configured timeout', async () => {
    jest.useFakeTimers();

    const fetchImplementation = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('request aborted'));
          });
        }),
    );

    const result = loadSamlMetadata({
      environment: 'development',
      fetchImplementation,
      timeoutMs: 25,
      url: 'https://sso.example.test/metadata',
    });
    const expectation = expect(result).rejects.toThrow(/délai de 25 ms/);

    await jest.advanceTimersByTimeAsync(25);
    await expectation;
  });
});
