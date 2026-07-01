import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractPdfDocument } from './index.js';
import type { PdfPageText, PdfTextExtraction, PdfTextItem } from './types.js';

vi.mock('./pdf-text.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pdf-text.js')>();
  return {
    ...actual,
    extractPdfText: vi.fn(),
  };
});

const { extractPdfText } = await import('./pdf-text.js');

function buildItems(
  lines: Array<{ text: string; x: number; y: number }>,
  pageNumber: number,
): PdfTextItem[] {
  return lines.map((line) => ({
    text: line.text,
    pageNumber,
    x: line.x,
    y: line.y,
    width: 100,
    height: 10,
  }));
}

function buildPage(
  lines: Array<{ text: string; x: number; y: number }>,
  pageNumber = 1,
): PdfPageText {
  const width = 595;
  const height = 842;
  const items = buildItems(lines, pageNumber);
  const lineTexts = items
    .map((item) => item.text)
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return {
    pageNumber,
    width,
    height,
    items,
    lines: [lineTexts],
    text: lineTexts,
  };
}

function buildExtraction(pages: PdfPageText[]): PdfTextExtraction {
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

beforeEach(() => {
  vi.mocked(extractPdfText).mockReset();
});

describe('extractPdfDocument — standard result', () => {
  it('extracts a complete REQUEST_MISSING_PARTS document with exact values', async () => {
    const page = buildPage([
      { text: 'Tribunal judiciaire de Lille', x: 70, y: 800 },
      { text: "Bureau d'aide juridictionnelle", x: 70, y: 785 },
      { text: 'Avenue du Peuple Belge', x: 70, y: 770 },
      { text: 'BP 729', x: 70, y: 755 },
      { text: '59034 Lille', x: 70, y: 740 },
      { text: 'Madame Marie Dupont', x: 320, y: 600 },
      { text: '10 rue de la Paix', x: 320, y: 585 },
      { text: '59000 LILLE', x: 320, y: 570 },
      { text: 'DEMANDE DE PIÈCES OU INFORMATIONS COMPLÉMENTAIRES', x: 70, y: 500 },
      { text: 'Lille, le 15 janvier 2025', x: 70, y: 480 },
      { text: 'Numéro de la demande : c-59350-2025-012305', x: 70, y: 460 },
    ]);
    vi.mocked(extractPdfText).mockResolvedValue(buildExtraction([page]));

    const result = await extractPdfDocument(new Uint8Array());

    expect(result.documentType).toBe('REQUEST_MISSING_PARTS');
    expect(result.documentTypeConfidence).toBeCloseTo(0.9);
    expect(result.jurisdiction?.value).toBe('Tribunal judiciaire de Lille');
    expect(result.service?.value).toBe("Bureau d'aide juridictionnelle");
    expect(result.requestNumber?.value).toBe('C-59350-2025-012305');
    expect(result.recipient?.fullName?.value).toBe('Marie Dupont');
    expect(result.recipient?.postalCode?.value).toBe('59000');
    expect(result.dates.letterDate?.value).toBe('15 janvier 2025');
    expect(result.validation.status).toBe('OK');
    expect(result.confidence.overall).toBeGreaterThan(0);
  });

  it('returns TEXT_EXTRACTION_FAILED when the page is too short', async () => {
    const page = buildPage([{ text: 'trop court', x: 70, y: 800 }]);
    vi.mocked(extractPdfText).mockResolvedValue(buildExtraction([page]));

    const result = await extractPdfDocument(new Uint8Array());

    expect(result.validation.status).toBe('TEXT_EXTRACTION_FAILED');
    expect(result.validation.errors[0]?.code).toBe('TEXT_EXTRACTION_FAILED');
    expect(result.documentType).toBe('UNKNOWN');
  });

  it('classifies as UNKNOWN but keeps the document textually exploitable', async () => {
    const longLine = 'Mot '.repeat(30);
    const page = buildPage([{ text: longLine.trim(), x: 70, y: 800 }]);
    vi.mocked(extractPdfText).mockResolvedValue(buildExtraction([page]));

    const result = await extractPdfDocument(new Uint8Array());

    expect(result.documentType).toBe('UNKNOWN');
    expect(result.documentTypeConfidence).toBeCloseTo(0.2);
    expect(result.validation.status).not.toBe('TEXT_EXTRACTION_FAILED');
    expect(result.validation.issues.some((issue) => issue.code === 'UNKNOWN_DOCUMENT_TYPE')).toBe(
      true,
    );
  });
});

describe('extractPdfDocument — enriched result', () => {
  const fullPage = buildPage([
    { text: 'Tribunal judiciaire de Lille', x: 70, y: 800 },
    { text: "Bureau d'aide juridictionnelle", x: 70, y: 785 },
    { text: 'Madame Marie Dupont', x: 320, y: 600 },
    { text: '10 rue de la Paix', x: 320, y: 585 },
    { text: '59000 LILLE', x: 320, y: 570 },
    { text: 'DEMANDE DE PIÈCES OU INFORMATIONS COMPLÉMENTAIRES', x: 70, y: 500 },
    { text: 'Ligne de remplissage pour dépasser le seuil minimal de mots', x: 70, y: 480 },
    { text: 'Numéro de la demande : c-59350-2025-012305', x: 70, y: 460 },
  ]);

  beforeEach(() => {
    vi.mocked(extractPdfText).mockResolvedValue(buildExtraction([fullPage]));
  });

  it('does not include rawText / pageTexts / layoutBlocks by default', async () => {
    const result = await extractPdfDocument(new Uint8Array());
    expect(result.rawText).toBeUndefined();
    expect(result.pageTexts).toBeUndefined();
    expect(result.layoutBlocks).toBeUndefined();
  });

  it('includes rawText, pageTexts and layoutBlocks when requested', async () => {
    const result = await extractPdfDocument(new Uint8Array(), {
      includeRawText: true,
      includePageTexts: true,
      includeLayout: true,
    });

    expect(result.rawText).toBe(fullPage.text);
    expect(result.pageTexts).toHaveLength(1);
    expect(result.pageTexts?.[0]?.pageNumber).toBe(1);
    expect(result.pageTexts?.[0]?.wordCount).toBeGreaterThan(0);
    expect(result.layoutBlocks?.length).toBe(fullPage.items.length);
    expect(result.layoutBlocks?.[0]).toMatchObject({
      pageNumber: 1,
      x: expect.any(Number),
      y: expect.any(Number),
    });
  });

  it('includes only rawText when only includeRawText is set', async () => {
    const result = await extractPdfDocument(new Uint8Array(), { includeRawText: true });
    expect(result.rawText).toBe(fullPage.text);
    expect(result.pageTexts).toBeUndefined();
    expect(result.layoutBlocks).toBeUndefined();
  });
});
