import { Injectable } from '@angular/core';
import { authClient } from './auth.client';

export type AuthenticationResult = 'authenticated' | 'redirecting';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  async requireAuthentication(): Promise<AuthenticationResult> {
    const sessionResult = await authClient.getSession();

    if (sessionResult.error) {
      throw new Error('La session ne peut pas être vérifiée.');
    }

    if (sessionResult.data?.session) {
      return 'authenticated';
    }

    const callbackUrl = new URL(window.location.href);
    if (callbackUrl.searchParams.has('error')) {
      throw new Error('Le fournisseur SSO a refusé ou interrompu la connexion.');
    }

    callbackUrl.searchParams.delete('error_description');

    const signInResult = await authClient.signIn.sso({
      callbackURL: callbackUrl.toString(),
      errorCallbackURL: callbackUrl.toString(),
      providerType: 'saml',
    });

    if (signInResult.error) {
      throw new Error('La connexion SSO ne peut pas être initialisée.');
    }

    return 'redirecting';
  }
}
