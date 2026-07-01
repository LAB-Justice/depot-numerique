import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DOCUMENTS_SERVICE } from '../../core/documents/documents.service';
import type { MailType } from '../../core/models/document.model';
import { mailTypeLabel, statusLabel } from '../../core/models/status-labels';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';

type Filter = 'ALL' | MailType;

@Component({
  selector: 'app-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyStateComponent, StatusBadgeComponent],
  templateUrl: './history.component.html',
})
export class HistoryComponent {
  private readonly documents = inject(DOCUMENTS_SERVICE);

  protected readonly filter = signal<Filter>('ALL');
  private readonly reload = signal(0);

  protected readonly docs = resource({
    params: () => ({ filter: this.filter(), tick: this.reload() }),
    loader: ({ params }) =>
      params.filter === 'ALL' ? this.documents.list() : this.documents.list(params.filter),
  });

  protected readonly filters: readonly Filter[] = ['ALL', 'LR', 'LS'];

  protected label(mailType: MailType): string {
    return mailTypeLabel(mailType);
  }

  protected statusText(status: string): string {
    return statusLabel(status as Parameters<typeof statusLabel>[0]);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / 1_048_576).toFixed(1)} Mo`;
  }

  protected setFilter(f: Filter): void {
    this.filter.set(f);
  }

  protected refresh(): void {
    this.reload.update((t) => t + 1);
  }
}
