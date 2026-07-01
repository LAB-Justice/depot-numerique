import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';

import { SessionService } from '../session/session.service';

/**
 * Protège les routes nécessitant un agent authentifié via le SSO.
 * Déclenche le flux OIDC vers Keycloak si la session n'est pas active.
 */
export const authGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (session.isAuthenticated()) return true;
  session.login();
  return false;
};
