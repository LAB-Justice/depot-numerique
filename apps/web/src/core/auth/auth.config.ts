import type { AuthConfig } from 'angular-oauth2-oidc';

const LOCAL_SSO_ORIGIN = 'http://localhost:8080';
const WEB_ORIGIN = 'http://localhost:4200';

export const localSsoAuthConfig: AuthConfig = {
  issuer: `${LOCAL_SSO_ORIGIN}/realms/depot-numerique`,
  clientId: 'depot-numerique',
  responseType: 'code',
  scope: 'openid profile email',
  redirectUri: WEB_ORIGIN,
  postLogoutRedirectUri: WEB_ORIGIN,
  requireHttps: false,
  strictDiscoveryDocumentValidation: true,
  showDebugInformation: false,
};
