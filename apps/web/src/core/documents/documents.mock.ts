import { Injectable, inject } from '@angular/core';

import type { DocumentItem, DocumentStatus, MailType } from '../models/document.model';
import { SessionService } from '../session/session.service';
import type { DocumentsService } from './documents.service';

/**
 * Implémentation mock de `DocumentsService`.
 *
 * Garde un store en mémoire et simule l'avancée du cycle de vie d'un document
 * (réception → analyse → correction LLM éventuelle → dépôt) de façon asynchrone,
 * afin de rendre la v1 démontrable sans backend.
 *
 * Enregistrée dans `app.config.ts` via `{ provide: DOCUMENTS_SERVICE, useClass: DocumentsMock }`.
 */
@Injectable()
export class DocumentsMock implements DocumentsService {
  private readonly session = inject(SessionService);
  private readonly store = new Map<string, DocumentItem>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.seed();
  }

  async upload(file: File, mailType: MailType): Promise<DocumentItem> {
    const profile = this.session.profile();
    if (!profile) {
      throw new Error('Aucun profil agent actif : dépôt impossible.');
    }

    const now = new Date().toISOString();
    const serviceCode = profile.serviceCode ?? 'JURIDICTION';
    const item: DocumentItem = {
      id: crypto.randomUUID(),
      mailType,
      status: 'RECEIVED',
      filename: file.name,
      sizeBytes: file.size,
      depositorRef: profile.agentRef,
      jurisdictionCode: profile.jurisdictionCode,
      serviceCode,
      createdAt: now,
      updatedAt: now,
    };

    this.store.set(item.id, item);
    this.scheduleProgression(item.id);
    return { ...item };
  }

  async list(mailType?: MailType): Promise<DocumentItem[]> {
    const items = [...this.store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mailType ? items.filter((i) => i.mailType === mailType) : items;
  }

  async get(id: string): Promise<DocumentItem | undefined> {
    const item = this.store.get(id);
    return item ? { ...item } : undefined;
  }

  /**
   * Avance le statut d'un document selon le flux futur.
   * On simule ici deux issues : la plupart des documents passent par une
   * correction LLM avant d'être déposés.
   */
  private scheduleProgression(id: string): void {
    const steps: { status: DocumentStatus; delay: number }[] = [
      { status: 'STORED', delay: 900 },
      { status: 'ANALYZING', delay: 2200 },
      { status: 'NON_COMPLIANT', delay: 3800 },
      { status: 'LLM_PENDING', delay: 5200 },
      { status: 'CORRECTED', delay: 7000 },
      { status: 'QUEUED', delay: 8200 },
      { status: 'SUBMITTING', delay: 9800 },
      { status: 'SUBMITTED', delay: 11500 },
    ];

    for (const step of steps) {
      const t = setTimeout(() => this.advance(id, step.status), step.delay);
      this.timers.get(id) ?? this.timers.set(id, t);
    }
  }

  private advance(id: string, status: DocumentStatus): void {
    const item = this.store.get(id);
    if (!item) return;
    this.store.set(id, { ...item, status, updatedAt: new Date().toISOString() });
  }

  /** Quelques documents d'exemple pour peupler l'historique. */
  private seed(): void {
    const samples: Array<Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        mailType: 'LR',
        status: 'SUBMITTED',
        filename: 'jugement-2026-001.pdf',
        sizeBytes: 248_320,
        depositorRef: 'ag-0427',
        jurisdictionCode: 'TJ-LILLE',
        serviceCode: 'BAJ',
      },
      {
        mailType: 'LS',
        status: 'COMPLIANT',
        filename: 'convocation-2026-014.pdf',
        sizeBytes: 96_512,
        depositorRef: 'ag-0427',
        jurisdictionCode: 'TJ-LILLE',
        serviceCode: 'BAJ',
      },
      {
        mailType: 'LR',
        status: 'ANALYZING',
        filename: 'signification-2026-007.pdf',
        sizeBytes: 312_704,
        depositorRef: 'ag-0427',
        jurisdictionCode: 'TJ-LILLE',
        serviceCode: 'BAJ',
      },
    ];

    const base = Date.now();
    for (const [i, s] of samples.entries()) {
      const ts = new Date(base - (i + 1) * 3_600_000).toISOString();
      this.store.set(crypto.randomUUID(), {
        ...s,
        id: crypto.randomUUID(),
        createdAt: ts,
        updatedAt: ts,
      });
    }
  }
}
