import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DOCUMENTS_SERVICE } from '../../core/documents/documents.service';
import type { MailType } from '../../core/models/document.model';
import { DropzoneComponent } from '../../shared/ui/dropzone/dropzone.component';

@Component({
  selector: 'app-deposit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DropzoneComponent],
  templateUrl: './deposit.component.html',
})
export class DepositComponent {
  private readonly documents = inject(DOCUMENTS_SERVICE);
  private readonly router = inject(Router);

  /** Notifications de dépôt récentes, indexées par type de courrier. */
  protected readonly lastUpload = signal<Record<MailType, string | null>>({
    LR: null,
    LS: null,
  });
  protected readonly busy = signal(false);

  protected async onFiles(files: File[], mailType: MailType): Promise<void> {
    if (files.length === 0) return;
    this.busy.set(true);
    try {
      const doc = await this.documents.upload(files[0], mailType);
      this.lastUpload.update((s) => ({
        ...s,
        [mailType]: `${files[0].name} déposé — suivi en cours.`,
      }));
      // Court délai pour laisser voir l'accusé de dépôt, puis suivi du document.
      setTimeout(() => this.router.navigate(['/documents', doc.id]), 900);
    } finally {
      this.busy.set(false);
    }
  }
}
