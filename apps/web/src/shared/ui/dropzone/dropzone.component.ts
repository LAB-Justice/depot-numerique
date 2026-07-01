import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  input,
  Output,
  signal,
} from '@angular/core';

import { MAIL_TYPE_LABEL, type MailType } from '../../../core/models/document.model';

/**
 * Zone de dépôt par glisser-déposer réutilisable.
 * Pilotée par le `mailType` (LR ou LS) : émet les fichiers sélectionnés
 * via `filesSelected` — la logique d'upload reste à la page consommatrice.
 */
@Component({
  selector: 'app-dropzone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="button"
      tabindex="0"
      [attr.aria-label]="ariaLabel()"
      [class]="zoneClasses()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      (click)="fileInput.click()"
      (keydown.enter)="fileInput.click()"
      (keydown.space)="fileInput.click()"
    >
      <input
        #fileInput
        type="file"
        accept="application/pdf"
        multiple
        class="hidden"
        (change)="onFileInput($event)"
      />

      <div class="flex flex-col items-center gap-3 text-center">
        <span [class]="iconWrapperClasses()">
          <svg [class]="iconClasses()" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 7.5m0 0L7.5 12M12 7.5v9"
            />
          </svg>
        </span>

        <div>
          <p class="text-sm font-semibold text-tx">
            {{ mailTypeLabel() }} — déposer vos fichiers
          </p>
          <p class="mt-1 text-xs text-tx-muted">
            Glissez-déposez vos PDF ici, ou cliquez pour les sélectionner.
          </p>
        </div>

        <span
          [class]="tagClasses()"
          aria-hidden="true"
        >{{ mailType() }}</span>
      </div>
    </div>
  `,
})
export class DropzoneComponent {
  readonly mailType = input.required<MailType>();
  readonly disabled = input(false);

  @Output() filesSelected = new EventEmitter<File[]>();

  private readonly _dragging = signal(false);

  protected readonly mailTypeLabel = computed(() => MAIL_TYPE_LABEL[this.mailType()]);
  protected readonly ariaLabel = computed(
    () => `Zone de dépôt pour les ${this.mailTypeLabel().toLowerCase()}s`,
  );

  protected readonly zoneClasses = computed(() => {
    const base =
      'group flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-bf focus-visible:ring-offset-2';
    return this._dragging()
      ? `${base} border-bf bg-bf-950`
      : `${base} border-grey bg-white hover:border-bf hover:bg-bf-925`;
  });

  protected readonly iconWrapperClasses = computed(() =>
    this._dragging()
      ? 'flex size-12 items-center justify-center rounded-full bg-bf text-white'
      : 'flex size-12 items-center justify-center rounded-full bg-bf-925 text-bf',
  );

  protected readonly iconClasses = computed(
    () => 'size-6 transition-transform group-hover:scale-110',
  );

  protected readonly tagClasses = computed(() =>
    this.mailType() === 'LR'
      ? 'inline-flex items-center rounded px-2 py-0.5 text-xs font-bold tracking-wide text-white bg-rm'
      : 'inline-flex items-center rounded px-2 py-0.5 text-xs font-bold tracking-wide text-white bg-bf',
  );

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.disabled()) this._dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this._dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this._dragging.set(false);
    if (this.disabled()) return;
    const files = Array.from(event.dataTransfer?.files ?? []).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );
    if (files.length > 0) this.filesSelected.emit(files);
  }

  protected onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length > 0) this.filesSelected.emit(files);
    input.value = '';
  }
}
