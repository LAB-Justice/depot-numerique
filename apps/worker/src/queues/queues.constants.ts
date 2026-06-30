/**
 * Registre central des noms de queues BullMQ utilisées par le worker.
 *
 * Le nommage suit le pipeline de dépôt de documents (voir spec) :
 * - TEST:            queue de démonstration pour valider le setup BullMQ
 * - PREPROCESS:      pré-traitement et validation du document
 * - LLM_CORRECTION:  reformatage automatique par LLM des pages non conformes
 * - DEPOSIT:         dépôt IMPRIMFIP via Playwright / API
 */
export const QUEUES = {
  TEST: 'test',
  PREPROCESS: 'preprocess',
  LLM_CORRECTION: 'llm-correction',
  DEPOSIT: 'deposit',
} as const;
