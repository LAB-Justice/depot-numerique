import { extractPdfText } from './pdf-text.js';
import {
  buildValidation,
  classifyDocument,
  extractDates,
  extractJurisdiction,
  extractRecipient,
  extractRequestNumber,
  extractSender,
  extractService,
  missingIssue,
  recipientCompleteness,
  recipientIssues,
} from './rules.js';
import { pdfExtractionResultSchema } from './schemas.js';
import type {
  DocumentType,
  ExtractedDates,
  ExtractedField,
  ExtractedRecipient,
  ExtractedSender,
  ExtractionCompleteness,
  ExtractionConfidence,
  ExtractionOptions,
  ExtractionValidation,
  LayoutBlock,
  PageText,
  PdfExtractionResult,
  PdfTextExtraction,
  ValidationIssue,
} from './types.js';

export { pdfExtractionResultSchema } from './schemas.js';
export type {
  DocumentClassification,
  DocumentType,
  ExtractedDates,
  ExtractedField,
  ExtractedRecipient,
  ExtractedSender,
  ExtractionCompleteness,
  ExtractionConfidence,
  ExtractionMethod,
  ExtractionOptions,
  ExtractionValidation,
  LayoutBlock,
  PageMetrics,
  PageText,
  PdfExtractionResult,
  PdfPageText,
  PdfTextExtraction,
  PdfTextItem,
  ValidationIssue,
  ValidationIssueCode,
  ValidationStatus,
} from './types.js';

const DEFAULT_MIN_PAGE_ONE_CHARACTERS = 100;
const DEFAULT_MIN_PAGE_ONE_WORDS = 20;

export async function extractPdfDocument(
  input: Buffer | Uint8Array,
  options: ExtractionOptions = {},
): Promise<PdfExtractionResult> {
  const extraction = await extractPdfText(input);
  const firstPage = extraction.pages[0];
  const issues: ValidationIssue[] = [];
  const minCharacters = options.minPageOneCharacters ?? DEFAULT_MIN_PAGE_ONE_CHARACTERS;
  const minWords = options.minPageOneWords ?? DEFAULT_MIN_PAGE_ONE_WORDS;
  const firstPageMetrics = extraction.metrics[0];

  if (
    !firstPage ||
    !firstPageMetrics ||
    firstPageMetrics.characterCount < minCharacters ||
    firstPageMetrics.wordCount < minWords
  ) {
    return pdfExtractionResultSchema.parse({
      documentType: 'UNKNOWN',
      documentTypeConfidence: 0.2,
      dates: {},
      confidence: {
        overall: 0,
      },
      completeness: { recipient: 0 },
      validation: buildValidation(extraction, issues),
      pages: extraction.metrics,
    }) as PdfExtractionResult;
  }

  const classification = classifyDocument(extraction.fullText);
  const jurisdiction = extractJurisdiction(firstPage);
  const service = extractService(firstPage);
  const requestNumber = extractRequestNumber(extraction.fullText);
  const recipient = extractRecipient(firstPage);
  const sender = extractSender(firstPage);
  const dates = extractDates(extraction.fullText);

  if (classification.documentType === 'UNKNOWN') {
    issues.push({
      code: 'UNKNOWN_DOCUMENT_TYPE',
      message: 'Type de document non reconnu.',
      severity: 'warning',
    });
  }
  if (!jurisdiction) issues.push(missingIssue('MISSING_JURISDICTION', 'Juridiction'));
  if (!service) issues.push(missingIssue('MISSING_SERVICE', 'Service'));
  // Le numéro de demande au format C-... est spécifique aux courriers BAJ reconnus.
  // Les documents BOG / PORTALIS (classés UNKNOWN) peuvent utiliser d'autres identifiants :
  // on ne signale son absence que pour les types de documents explicitement reconnus.
  if (!requestNumber && classification.documentType !== 'UNKNOWN') {
    issues.push(missingIssue('MISSING_REQUEST_NUMBER', 'Numéro de demande'));
  }
  if (!recipient) {
    issues.push(missingIssue('MISSING_RECIPIENT', 'Destinataire'));
  } else {
    issues.push(...recipientIssues(recipient));
  }

  const validation = buildValidation(extraction, issues);
  const confidence = buildConfidence(classification, { recipient, sender, dates, validation });
  const completeness: ExtractionCompleteness = {
    recipient: recipientCompleteness(recipient),
  };

  const result: PdfExtractionResult = {
    documentType: classification.documentType,
    documentTypeConfidence: classification.confidence,
    dates,
    confidence,
    completeness,
    validation,
    pages: extraction.metrics,
  };
  if (jurisdiction) result.jurisdiction = jurisdiction;
  if (service) result.service = service;
  if (requestNumber) result.requestNumber = requestNumber;
  if (recipient) result.recipient = recipient;
  if (sender) result.sender = sender;

  if (options.includeRawText) result.rawText = extraction.fullText;
  if (options.includePageTexts) result.pageTexts = buildPageTexts(extraction);
  if (options.includeLayout) result.layoutBlocks = buildLayoutBlocks(extraction);

  return pdfExtractionResultSchema.parse(result) as PdfExtractionResult;
}

interface ConfidenceInputs {
  recipient: ExtractedRecipient | undefined;
  sender: ExtractedSender | undefined;
  dates: ExtractedDates;
  validation: ExtractionValidation;
}

function buildConfidence(
  classification: { documentType: DocumentType; confidence: number },
  inputs: ConfidenceInputs,
): ExtractionConfidence {
  const recipient = averageConfidence([
    inputs.recipient?.civility,
    inputs.recipient?.fullName,
    inputs.recipient?.postalCode,
    inputs.recipient?.city,
  ]);
  const sender = averageConfidence([
    inputs.sender?.jurisdiction,
    inputs.sender?.service,
    inputs.sender?.phone,
  ]);
  const dates = averageConfidence([
    inputs.dates.letterDate,
    inputs.dates.requestDate,
    inputs.dates.decisionDate,
  ]);

  const present = [recipient, sender, dates].filter(
    (value): value is number => value !== undefined,
  );
  const sectionAverage =
    present.length > 0 ? present.reduce((sum, value) => sum + value, 0) / present.length : 0;

  let overall = sectionAverage;
  if (classification.documentType === 'UNKNOWN') overall *= 0.5;
  if (inputs.validation.errors.length > 0) overall -= inputs.validation.errors.length * 0.15;
  if (inputs.validation.warnings.length > 0) overall -= inputs.validation.warnings.length * 0.05;
  if (present.length === 0) overall = Math.min(overall, classification.confidence);

  const confidence: ExtractionConfidence = {
    overall: clamp01(overall),
  };
  if (recipient !== undefined) confidence.recipient = recipient;
  if (sender !== undefined) confidence.sender = sender;
  if (dates !== undefined) confidence.dates = dates;
  return confidence;
}

function averageConfidence(fields: Array<ExtractedField<unknown> | undefined>): number | undefined {
  const confidences = fields
    .filter((entry): entry is ExtractedField<unknown> => entry !== undefined)
    .map((entry) => entry.confidence);
  if (confidences.length === 0) return undefined;
  return clamp01(confidences.reduce((sum, value) => sum + value, 0) / confidences.length);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function buildPageTexts(extraction: PdfTextExtraction): PageText[] {
  return extraction.pages.map((page) => {
    const text = page.text.trim();
    return {
      pageNumber: page.pageNumber,
      text,
      characterCount: text.length,
      wordCount: text ? text.split(/\s+/u).length : 0,
    };
  });
}

function buildLayoutBlocks(extraction: PdfTextExtraction): LayoutBlock[] {
  return extraction.pages.flatMap((page) =>
    page.items.map((item) => ({
      pageNumber: item.pageNumber,
      text: item.text,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    })),
  );
}
