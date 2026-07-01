import { type DocumentStatus, MAIL_TYPE_LABEL, type MailType } from './document.model';

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

interface StatusMeta {
  label: string;
  tone: StatusTone;
}

const STATUS_META: Record<DocumentStatus, StatusMeta> = {
  RECEIVED: { label: 'Reçu', tone: 'neutral' },
  STORED: { label: 'Stocké', tone: 'info' },
  STORAGE_FAILED: { label: 'Échec du stockage', tone: 'error' },
  ANALYZING: { label: 'Analyse en cours', tone: 'info' },
  ANALYSIS_FAILED: { label: 'Échec de l’analyse', tone: 'error' },
  NON_COMPLIANT: { label: 'Non conforme', tone: 'warning' },
  EXTRACTING: { label: 'Extraction du contenu', tone: 'info' },
  LLM_PENDING: { label: 'Correction LLM en cours', tone: 'info' },
  LLM_FAILED: { label: 'Échec de la correction LLM', tone: 'error' },
  GENERATING_AFNOR: { label: 'Génération de la trame AFNOR', tone: 'info' },
  CORRECTED: { label: 'Corrigé', tone: 'info' },
  COMPLIANT: { label: 'Conforme', tone: 'success' },
  QUEUED: { label: 'En file de dépôt', tone: 'info' },
  SUBMITTING: { label: 'Dépôt en cours', tone: 'info' },
  SUBMITTED: { label: 'Déposé', tone: 'success' },
  SUBMISSION_FAILED: { label: 'Échec du dépôt', tone: 'error' },
  REJECTED: { label: 'Rejeté', tone: 'error' },
  PURGED: { label: 'Purgé', tone: 'neutral' },
};

export function statusMeta(status: DocumentStatus): StatusMeta {
  return STATUS_META[status];
}

export function statusLabel(status: DocumentStatus): string {
  return statusMeta(status).label;
}

export function mailTypeLabel(mailType: MailType): string {
  return MAIL_TYPE_LABEL[mailType];
}
