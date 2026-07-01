import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Pied de page sobre, aligné sur la charte de l'État.
 */
@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="border-t border-grey bg-white">
      <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-tx-muted sm:flex-row">
        <span>Ministère de la Justice — Dépôt Numérique</span>
        <span>Plateforme de dépôt de documents judiciaires</span>
      </div>
    </footer>
  `,
})
export class FooterComponent {}
