export interface CreateSamlSpMetadataOptions {
  baseUrl: string;
  encryptionCertificateBase64: string;
  entityId: string;
  providerId: string;
  signingCertificateBase64: string;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function createSamlSpMetadata(options: CreateSamlSpMetadataOptions): string {
  const acsUrl = new URL(
    `/api/auth/sso/saml2/sp/acs/${options.providerId}`,
    options.baseUrl,
  ).toString();
  const sloUrl = new URL(
    `/api/auth/sso/saml2/sp/slo/${options.providerId}`,
    options.baseUrl,
  ).toString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" entityID="${escapeXml(options.entityId)}">
  <md:SPSSODescriptor AuthnRequestsSigned="true" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${options.signingCertificateBase64}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:KeyDescriptor use="encryption">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${options.encryptionCertificateBase64}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${escapeXml(sloUrl)}" />
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${escapeXml(acsUrl)}" index="0" isDefault="true" />
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}
