import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DOCUMENTS_SERVICE } from '../../core/documents/documents.service';
import type { DocumentStatus, MailType } from '../../core/models/document.model';
import { mailTypeLabel } from '../../core/models/status-labels';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';

/**
 * Étapes ordonnées du cycle de vie d'un document (DAT §3).
 * Chaque étape regroupe les statuts Prisma correspondants.
 */
interface Stage {
  title: string;
  description: string;
  statuses: DocumentStatus[];
}

const STAGES: readonly Stage[] = [
  {
    title: 'Réception & stockage',
    description: 'Le fichier est reçu et stocké dans MinIO, enregistré en base.',
    statuses: ['RECEIVED', 'STORAGE_FAILED'],
  },
  {
    title: 'Analyse de conformité',
    description: 'Vérification du numéro de dossier et de la trame IMPRIMFIP.',
    statuses: ['STORED', 'ANALYZING', 'ANALYSIS_FAILED', 'COMPLIANT'],
  },
  {
    title: 'Correction LLM (si non conforme)',
    description: 'Reformatage de la page 1 par le modèle de langage.',
    statuses: [
      'NON_COMPLIANT',
      'EXTRACTING',
      'LLM_PENDING',
      'LLM_FAILED',
      'GENERATING_AFNOR',
      'CORRECTED',
    ],
  },
  {
    title: 'Dépôt sur IMPRIMFIP',
    description: 'Transmission via Playwright ou via l’API IMPRIMFIP.',
    statuses: ['QUEUED', 'SUBMITTING', 'SUBMISSION_FAILED', 'REJECTED'],
  },
  {
    title: 'Terminé',
    description: 'Document déposé avec succès.',
    statuses: ['SUBMITTED', 'PURGED'],
  },
];

type StageState = 'done' | 'active' | 'todo';

@Component({
  selector: 'app-document-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatusBadgeComponent],
  templateUrl: './document-detail.component.html',
})
export class DocumentDetailComponent {
  private readonly documents = inject(DOCUMENTS_SERVICE);

  private readonly route = inject(ActivatedRoute);
  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))));

  protected readonly doc = resource({
    params: () => this.id(),
    loader: ({ params }) => this.documents.get(params ?? ''),
  });

  protected readonly stages = computed<readonly Stage[]>(() => STAGES);

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

  protected mailLabel(mailType: MailType): string {
    return mailTypeLabel(mailType);
  }

  protected stageState(stage: Stage, current: DocumentStatus): StageState {
    const currentStageIndex = STAGES.findIndex((s) => s.statuses.includes(current));
    const stageIndex = STAGES.indexOf(stage);
    if (stage.statuses.includes(current)) return 'active';
    if (stageIndex < currentStageIndex) return 'done';
    return 'todo';
  }
}
