import { describe, expect, it } from 'vitest';
import { buildLines } from './pdf-text.js';
import {
  buildValidation,
  classifyDocument,
  extractDates,
  extractJurisdiction,
  extractRecipient,
  extractRequestNumber,
  extractService,
  missingIssue,
} from './rules.js';
import type { PdfPageText, PdfTextExtraction, PdfTextItem, ValidationIssue } from './types.js';

function pageFromLines(lines: Array<{ text: string; x: number; y: number }>): PdfPageText {
  const pageNumber = 1;
  const width = 595;
  const height = 842;
  const items: PdfTextItem[] = lines.map((line) => ({
    text: line.text,
    pageNumber,
    x: line.x,
    y: line.y,
    width: 100,
    height: 10,
  }));
  return {
    pageNumber,
    width,
    height,
    items,
    lines: buildLines(items),
    text: buildLines(items).join('\n'),
  };
}

function extractionFromPages(pages: PdfPageText[]): PdfTextExtraction {
  const metrics = pages.map((page) => {
    const text = page.text.trim();
    return {
      pageNumber: page.pageNumber,
      characterCount: text.length,
      wordCount: text ? text.split(/\s+/u).length : 0,
      isEmpty: text.length === 0,
    };
  });
  return {
    pages,
    fullText: pages.map((page) => page.text).join('\n\n'),
    metrics,
  };
}

describe('classifyDocument', () => {
  it('classifies a request for missing parts', () => {
    const result = classifyDocument('DEMANDE DE PIÈCES OU INFORMATIONS COMPLÉMENTAIRES');
    expect(result.documentType).toBe('REQUEST_MISSING_PARTS');
    expect(result.confidence).toBeCloseTo(0.9);
  });

  it('classifies a decision notification', () => {
    const result = classifyDocument('NOTIFICATION D’UNE DÉCISION');
    expect(result.documentType).toBe('DECISION_NOTIFICATION');
    expect(result.confidence).toBeCloseTo(0.95);
  });

  it('classifies an aid decision', () => {
    const result = classifyDocument("DÉCISION D'AIDE JURIDICTIONNELLE");
    expect(result.documentType).toBe('AID_DECISION');
    expect(result.confidence).toBeCloseTo(0.95);
  });

  it('returns UNKNOWN for unrecognised content', () => {
    const result = classifyDocument('Bonjour, voici un courrier sans lien avec une procédure.');
    expect(result.documentType).toBe('UNKNOWN');
    expect(result.confidence).toBeCloseTo(0.2);
  });
});

describe('extractRequestNumber', () => {
  it('extracts and uppercases the request number', () => {
    const result = extractRequestNumber('Numéro de la demande : c-59350-2025-012305');
    expect(result?.value).toBe('C-59350-2025-012305');
    expect(result?.method).toBe('REGEX');
    expect(result?.confidence).toBeCloseTo(0.99);
  });

  it('returns undefined when no request number is present', () => {
    expect(extractRequestNumber('Aucun numéro ici')).toBeUndefined();
  });
});

describe('extractDates', () => {
  it('extracts letter, request and decision dates', () => {
    const text = [
      'Lille, le 15 janvier 2025',
      'Date de la demande : 10 janvier 2025',
      'Date décision : 8 janvier 2025',
    ].join('\n');
    const dates = extractDates(text);
    expect(dates.letterDate?.value).toBe('15 janvier 2025');
    expect(dates.requestDate?.value).toBe('10 janvier 2025');
    expect(dates.decisionDate?.value).toBe('8 janvier 2025');
  });

  it('returns empty object when no dates are present', () => {
    expect(extractDates('Pas de date ici')).toEqual({});
  });
});

describe('layout extraction (jurisdiction / service / recipient)', () => {
  const page = pageFromLines([
    { text: 'Tribunal judiciaire de Lille', x: 70, y: 800 },
    { text: "Bureau d'aide juridictionnelle", x: 70, y: 785 },
    { text: 'Avenue du Peuple Belge', x: 70, y: 770 },
    { text: 'BP 729', x: 70, y: 755 },
    { text: '59034 Lille', x: 70, y: 740 },
    { text: 'Madame Marie Dupont', x: 320, y: 600 },
    { text: '10 rue de la Paix', x: 320, y: 585 },
    { text: '59000 LILLE', x: 320, y: 570 },
  ]);

  it('extracts the jurisdiction', () => {
    expect(extractJurisdiction(page)?.value).toBe('Tribunal judiciaire de Lille');
  });

  it('extracts the service', () => {
    expect(extractService(page)?.value).toBe("Bureau d'aide juridictionnelle");
  });

  it('extracts the recipient with multi-line address', () => {
    const recipient = extractRecipient(page);
    expect(recipient?.civility?.value).toBe('Madame');
    expect(recipient?.fullName?.value).toBe('Marie Dupont');
    expect(recipient?.streetNumber?.value).toBe('10');
    expect(recipient?.streetType?.value).toBe('rue');
    expect(recipient?.streetName?.value).toBe('de la Paix');
    expect(recipient?.postalCode?.value).toBe('59000');
    expect(recipient?.city?.value).toBe('LILLE');
    expect(recipient?.addressLines.value).toEqual(['10 rue de la Paix', '59000 LILLE']);
  });

  it('returns undefined when no jurisdiction matches', () => {
    const empty = pageFromLines([{ text: 'Courrier quelconque', x: 70, y: 800 }]);
    expect(extractJurisdiction(empty)).toBeUndefined();
  });
});

describe('buildValidation', () => {
  const richExtraction = extractionFromPages([
    pageFromLines(
      Array.from({ length: 25 }, (_, i) => ({ text: `ligne ${i}`, x: 70, y: 800 - i * 12 })),
    ),
  ]);

  it('returns OK with empty issues and full score', () => {
    const validation = buildValidation(richExtraction, []);
    expect(validation.status).toBe('OK');
    expect(validation.score).toBe(1);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual([]);
  });

  it('splits issues into errors and warnings', () => {
    const issues: ValidationIssue[] = [
      missingIssue('MISSING_JURISDICTION', 'Juridiction'),
      { code: 'TEXT_EXTRACTION_FAILED', message: 'echec', severity: 'error' },
    ];
    const validation = buildValidation(richExtraction, issues);
    expect(validation.status).toBe('PARTIAL');
    expect(validation.issues).toHaveLength(2);
    expect(validation.errors).toHaveLength(1);
    expect(validation.warnings).toHaveLength(1);
  });

  it('flags TEXT_EXTRACTION_FAILED on an empty first page', () => {
    const empty = extractionFromPages([pageFromLines([])]);
    const validation = buildValidation(empty, []);
    expect(validation.status).toBe('TEXT_EXTRACTION_FAILED');
    expect(validation.score).toBe(0);
    expect(validation.errors[0]?.code).toBe('TEXT_EXTRACTION_FAILED');
  });
});

describe('missingIssue', () => {
  it('builds a warning issue with the typed code', () => {
    const issue = missingIssue('MISSING_RECIPIENT', 'Destinataire');
    expect(issue).toEqual({
      code: 'MISSING_RECIPIENT',
      message: 'Destinataire non extrait.',
      severity: 'warning',
    });
  });
});
