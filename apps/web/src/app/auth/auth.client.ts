import { ssoClient } from '@better-auth/sso/client';
import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
  plugins: [ssoClient()],
});
