import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { DocumentStatus } from '../../../core/models/document.model';
import { statusMeta } from '../../../core/models/status-labels';

/**
 * Badge de statut réutilisable, mappant un `DocumentStatus`
 * à un libellé et une teinte (neutre / info / succès / alerte / erreur).
 */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()">
      <span [class]="dot()" aria-hidden="true"></span>
      {{ meta().label }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<DocumentStatus>();

  protected readonly meta = computed(() => statusMeta(this.status()));

  private static readonly TONE_BG: Record<string, string> = {
    neutral: 'bg-grey-light text-tx-muted',
    info: 'bg-info-bg text-info',
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    error: 'bg-error-bg text-error',
  };

  private static readonly TONE_DOT: Record<string, string> = {
    neutral: 'bg-tx-muted',
    info: 'bg-info',
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-error',
  };

  protected classes = computed(
    () =>
      `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${StatusBadgeComponent.TONE_BG[this.meta().tone]}`,
  );

  protected dot = computed(
    () => `size-1.5 rounded-full ${StatusBadgeComponent.TONE_DOT[this.meta().tone]}`,
  );
}
