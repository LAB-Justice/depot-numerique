import { createSamlSpMetadata } from './saml-sp-metadata';

describe('createSamlSpMetadata', () => {
  it('should expose signed and encrypted SP metadata', () => {
    const metadata = createSamlSpMetadata({
      baseUrl: 'https://depot.example.test',
      encryptionCertificateBase64: 'ENCRYPTION_CERTIFICATE',
      entityId: 'depot-numerique',
      providerId: 'justice-saml',
      signingCertificateBase64: 'SIGNING_CERTIFICATE',
    });

    expect(metadata).toContain('AuthnRequestsSigned="true"');
    expect(metadata).toContain('WantAssertionsSigned="true"');
    expect(metadata).toContain('<md:KeyDescriptor use="signing">');
    expect(metadata).toContain('<ds:X509Certificate>SIGNING_CERTIFICATE</ds:X509Certificate>');
    expect(metadata).toContain('<md:KeyDescriptor use="encryption">');
    expect(metadata).toContain('<ds:X509Certificate>ENCRYPTION_CERTIFICATE</ds:X509Certificate>');
    expect(metadata).toContain(
      'SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"',
    );
    expect(metadata).toContain(
      'AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"',
    );
    expect(metadata).toContain(
      'Location="https://depot.example.test/api/auth/sso/saml2/sp/acs/justice-saml"',
    );
    expect(metadata).toContain(
      'Location="https://depot.example.test/api/auth/sso/saml2/sp/slo/justice-saml"',
    );
  });

  it('should escape XML attributes', () => {
    const metadata = createSamlSpMetadata({
      baseUrl: 'https://depot.example.test',
      encryptionCertificateBase64: 'ENCRYPTION_CERTIFICATE',
      entityId: `depot&<numerique>"'`,
      providerId: 'justice saml&principal',
      signingCertificateBase64: 'SIGNING_CERTIFICATE',
    });

    expect(metadata).toContain('entityID="depot&amp;&lt;numerique&gt;&quot;&apos;"');
    expect(metadata).toContain('/acs/justice%20saml&amp;principal"');
    expect(metadata).not.toContain(`entityID="depot&<numerique>"'"`);
  });
});
