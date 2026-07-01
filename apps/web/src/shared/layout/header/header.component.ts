import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { SessionService } from '../../../core/session/session.service';

/**
 * En-tête de l'application : bandeau « Marianne », titre de l'app,
 * navigation principale et résumé du contexte agent (lecture seule).
 */
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  protected readonly session = inject(SessionService);

  protected logout(): void {
    this.session.logout();
  }
}
