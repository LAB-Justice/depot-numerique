/**
 * Miroir côté frontend des enums et modèles du schéma Prisma
 * (packages/database/prisma/schema.prisma).
 * Ces enums sont volontairement alignés 1:1 avec la base pour permettre
 * un branchement direct à l'API sans traduction.
 */

export type MailType = 'LR' | 'LS';

export const MAIL_TYPE_LABEL: Record<MailType, string> = {
  LR: 'Lettre recommandée',
  LS: 'Lettre simple',
};

/**
 * Cycle de vie d'un document, de la réception au dépôt sur IMPRIMFIP.
 * Les valeurs *_FAILED correspondent à un échec sur l'étape correspondante.
 */
export type DocumentStatus =
  | 'RECEIVED'
  | 'STORED'
  | 'STORAGE_FAILED'
  | 'ANALYZING'
  | 'ANALYSIS_FAILED'
  | 'NON_COMPLIANT'
  | 'EXTRACTING'
  | 'LLM_PENDING'
  | 'LLM_FAILED'
  | 'GENERATING_AFNOR'
  | 'CORRECTED'
  | 'COMPLIANT'
  | 'QUEUED'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'SUBMISSION_FAILED'
  | 'REJECTED'
  | 'PURGED';

/**
 * Profil agent résolu depuis les claims SSO (OIDC).
 * En v1, fourni par le SessionService à partir des claims OIDC Keycloak.
 * La juridiction et le service ne sont pas modifiables par l'agent.
 */
export interface AgentProfile {
  /** Nom d'affichage de l'agent. */
  displayName: string;
  /** Identifiant technique de l'agent dans l'annuaire SSO. */
  agentRef: string;
  /** Rôles applicatifs exposés par le client OIDC. */
  roles: Array<'agent' | 'chef_service' | 'directeur_greffe'>;
  /** Code SSO de la juridiction (ex. TJ-LILLE). */
  jurisdictionCode: string;
  /** Nom d'affichage de la juridiction. */
  jurisdictionName: string;
  /** Code SSO du service (ex. BAJ). */
  serviceCode?: string;
  /** Nom d'affichage du service. */
  serviceName?: string;
}

/**
 * Représentation d'un document déposé, alignée sur le modèle Prisma `Document`.
 */
export interface DocumentItem {
  id: string;
  mailType: MailType;
  status: DocumentStatus;
  filename: string;
  sizeBytes: number;
  depositorRef: string;
  jurisdictionCode: string;
  serviceCode: string;
  createdAt: string;
  updatedAt: string;
}
