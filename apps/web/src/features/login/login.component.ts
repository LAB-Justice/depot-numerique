import { ChangeDetectionStrategy, Component, inject, type OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { SessionService } from '../../core/session/session.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col items-center justify-center bg-grey-light px-4">
      <div class="w-full max-w-md">
        <div class="mb-6 rounded-t-lg bg-bf px-6 py-2 text-center text-xs font-semibold text-white">
          République Française
        </div>

        <div class="rounded-b-lg border border-grey bg-white p-8 shadow-sm">
          <div class="mb-6 flex flex-col items-center text-center">
            <span class="mb-3 flex size-14 items-center justify-center rounded bg-rm text-xl font-black text-white">
              RF
            </span>
            <h1 class="text-xl font-bold text-tx">Dépôt Numérique</h1>
            <p class="mt-1 text-sm text-tx-muted">
              Authentification via le SSO local Keycloak
            </p>
          </div>

          <button
            type="button"
            class="w-full rounded bg-bf px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bf-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bf"
            (click)="signIn()"
          >
            Se connecter avec le SSO
          </button>

          <p class="mt-4 text-center text-xs text-tx-muted">
            La juridiction et le service sont résolus depuis les claims SSO.
          </p>
        </div>

        <p class="mt-6 text-center text-xs text-tx-muted">
          Ministère de la Justice
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  ngOnInit(): void {
    if (this.session.isAuthenticated()) {
      this.router.navigate(['/deposit']);
    }
  }

  protected signIn(): void {
    this.session.login();
  }
}
