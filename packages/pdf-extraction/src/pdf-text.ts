import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PdfPageText, PdfTextExtraction, PdfTextItem } from './types.js';

interface PdfJsTextItem {
  str: string;
  width: number;
  height: number;
  transform: number[];
}

function isTextItem(item: unknown): item is PdfJsTextItem {
  if (typeof item !== 'object' || item === null) return false;
  const candidate = item as Partial<PdfJsTextItem>;
  return (
    typeof candidate.str === 'string' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    Array.isArray(candidate.transform)
  );
}

export async function extractPdfText(input: Buffer | Uint8Array): Promise<PdfTextExtraction> {
  const data = new Uint8Array(input);
  const loadingTask = getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  const pages: PdfPageText[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const textItem of textContent.items) {
      if (!isTextItem(textItem)) continue;
      const item = textItem;
      const text = normalizeSpaces(item.str);
      if (!text) continue;
      items.push({
        text,
        pageNumber,
        x: item.transform[4] ?? 0,
        y: item.transform[5] ?? 0,
        width: item.width,
        height: item.height,
      });
    }
    const lines = buildLines(items);

    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      items,
      lines,
      text: lines.join('\n'),
    });
  }

  const metrics = pages.map((page) => {
    const text = page.text.trim();
    const wordCount = text ? text.split(/\s+/u).length : 0;
    return {
      pageNumber: page.pageNumber,
      characterCount: text.length,
      wordCount,
      isEmpty: text.length === 0,
    };
  });

  return {
    pages,
    fullText: pages.map((page) => page.text).join('\n\n'),
    metrics,
  };
}

export function buildLines(items: PdfTextItem[]): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const grouped: PdfTextItem[][] = [];

  for (const item of sorted) {
    const line = grouped.find((candidate) => Math.abs((candidate[0]?.y ?? 0) - item.y) <= 3);
    if (line) {
      line.push(item);
    } else {
      grouped.push([item]);
    }
  }

  return grouped
    .map((line) =>
      line
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text)
        .join(' ')
        .replace(/\s+/gu, ' ')
        .trim(),
    )
    .filter(Boolean);
}

export function normalizeSpaces(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}
