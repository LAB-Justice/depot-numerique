import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OAuthService } from 'angular-oauth2-oidc';
import { localSsoAuthConfig } from '../auth/auth.config';
import { mapSsoClaimsToAgentProfile } from '../auth/sso-claims';
import type { AgentProfile } from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly oauthService = inject(OAuthService);

  private readonly _authenticated = signal(false);

  /** Profil agent actif, ou `null` tant que l'agent n'est pas connecté. */
  readonly profile = signal<AgentProfile | null>(null);

  readonly isAuthenticated = this._authenticated.asReadonly();

  constructor() {
    this.oauthService.events.pipe(takeUntilDestroyed()).subscribe(() => this.refreshSession());
  }

  async initialize(): Promise<void> {
    this.oauthService.configure(localSsoAuthConfig);
    await this.oauthService.loadDiscoveryDocumentAndTryLogin();
    this.refreshSession();
  }

  /** Lance le flux OIDC Authorization Code + PKCE vers Keycloak local. */
  login(): void {
    this.oauthService.initCodeFlow();
  }

  /** Termine la session et efface le profil. */
  logout(): void {
    this.clearSession();
    this.oauthService.logOut();
  }

  private refreshSession(): void {
    if (!this.oauthService.hasValidAccessToken() || !this.oauthService.hasValidIdToken()) {
      this.clearSession();
      return;
    }

    const profile = mapSsoClaimsToAgentProfile(this.oauthService.getIdentityClaims());
    this.profile.set(profile);
    this._authenticated.set(profile !== null);
  }

  private clearSession(): void {
    this.profile.set(null);
    this._authenticated.set(false);
  }
}
