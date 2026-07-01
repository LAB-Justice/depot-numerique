import { InjectionToken } from '@angular/core';

import type { DocumentItem, MailType } from '../models/document.model';

/**
 * Contrat d'accès aux documents.
 *
 * Implémentation courante : `DocumentsMock` (store en mémoire).
 * Pour brancher la vraie API : créer un `DocumentsApi` utilisant HttpClient
 * et remplacer le provider dans `app.config.ts`.
 */
export interface DocumentsService {
  upload(file: File, mailType: MailType): Promise<DocumentItem>;

  list(mailType?: MailType): Promise<DocumentItem[]>;

  get(id: string): Promise<DocumentItem | undefined>;
}

export const DOCUMENTS_SERVICE = new InjectionToken<DocumentsService>('DOCUMENTS_SERVICE');
