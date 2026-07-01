export type DocumentType =
  | 'REQUEST_MISSING_PARTS'
  | 'DECISION_NOTIFICATION'
  | 'AID_DECISION'
  | 'UNKNOWN';

export type ExtractionMethod = 'REGEX' | 'LAYOUT' | 'HEURISTIC';

export type ValidationStatus = 'OK' | 'PARTIAL' | 'TEXT_EXTRACTION_FAILED';

export type ValidationIssueCode =
  | 'TEXT_EXTRACTION_FAILED'
  | 'UNKNOWN_DOCUMENT_TYPE'
  | 'MISSING_JURISDICTION'
  | 'MISSING_SERVICE'
  | 'MISSING_REQUEST_NUMBER'
  | 'MISSING_RECIPIENT';

export interface ExtractionOptions {
  minPageOneCharacters?: number;
  minPageOneWords?: number;
  includeRawText?: boolean;
  includePageTexts?: boolean;
  includeLayout?: boolean;
}

export interface ExtractedField<T> {
  value: T;
  confidence: number;
  sourcePage: number;
  sourceText: string;
  method: ExtractionMethod;
}

export interface ExtractedRecipient {
  civility?: ExtractedField<string>;
  fullName?: ExtractedField<string>;
  organization?: ExtractedField<string>;
  addressLines: ExtractedField<string[]>;
  streetLine?: ExtractedField<string>;
  streetNumber?: ExtractedField<string>;
  streetType?: ExtractedField<string>;
  streetName?: ExtractedField<string>;
  addressComplement?: ExtractedField<string[]>;
  postalCode?: ExtractedField<string>;
  city?: ExtractedField<string>;
}

export interface ExtractedSender {
  jurisdiction?: ExtractedField<string>;
  service?: ExtractedField<string>;
  addressLines: ExtractedField<string[]>;
  phone?: ExtractedField<string>;
}

export interface ExtractedDates {
  letterDate?: ExtractedField<string>;
  requestDate?: ExtractedField<string>;
  decisionDate?: ExtractedField<string>;
}

export interface PageMetrics {
  pageNumber: number;
  characterCount: number;
  wordCount: number;
  isEmpty: boolean;
}

export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  severity: 'error' | 'warning';
}

export interface ExtractionValidation {
  status: ValidationStatus;
  score: number;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ExtractionConfidence {
  overall: number;
  recipient?: number;
  sender?: number;
  dates?: number;
}

export interface PageText {
  pageNumber: number;
  text: string;
  characterCount: number;
  wordCount: number;
}

export interface LayoutBlock {
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentClassification {
  documentType: DocumentType;
  confidence: number;
}

export interface PdfExtractionResult {
  documentType: DocumentType;
  documentTypeConfidence: number;
  jurisdiction?: ExtractedField<string>;
  service?: ExtractedField<string>;
  requestNumber?: ExtractedField<string>;
  recipient?: ExtractedRecipient;
  sender?: ExtractedSender;
  dates: ExtractedDates;
  confidence: ExtractionConfidence;
  validation: ExtractionValidation;
  pages: PageMetrics[];
  rawText?: string;
  pageTexts?: PageText[];
  layoutBlocks?: LayoutBlock[];
}

export interface PdfTextItem {
  text: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageText {
  pageNumber: number;
  width: number;
  height: number;
  items: PdfTextItem[];
  lines: string[];
  text: string;
}

export interface PdfTextExtraction {
  pages: PdfPageText[];
  fullText: string;
  metrics: PageMetrics[];
}
