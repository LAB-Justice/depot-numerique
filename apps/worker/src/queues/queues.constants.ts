/**
 * Registre central des noms de queues BullMQ utilisées par le worker.
 *
 * Le nommage suit le pipeline de dépôt de documents (voir spec) :
 * - TEST:            queue de démonstration pour valider le setup BullMQ
 * - PREPROCESS:      pré-traitement et validation du document (3.5)
 * - LLM_CORRECTION:  reformatage automatique par LLM des pages non conformes (3.5.4)
 * - DEPOSIT:         dépôt IMPRIMFIP via Playwright / API (3.6)
 */
export const QUEUES = {
  TEST: 'test',
  PREPROCESS: 'preprocess',
  LLM_CORRECTION: 'llm-correction',
  DEPOSIT: 'deposit',
} as const;
