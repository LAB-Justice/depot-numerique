import { buildLines, normalizeSpaces } from './pdf-text.js';
import type {
  DocumentClassification,
  ExtractedField,
  ExtractedRecipient,
  ExtractedSender,
  ExtractionMethod,
  PdfPageText,
  PdfTextExtraction,
  ValidationIssue,
  ValidationIssueCode,
  ValidationStatus,
} from './types.js';

const CIVILITY_PATTERN = /^(Madame|Monsieur|Mademoiselle|Ma(?:î|i)tre|Me)\b/iu;
const POSTAL_CITY_PATTERN = /\b(?<postalCode>\d{5})\s+(?<city>[A-ZÀ-Ÿ][A-ZÀ-Ÿ' -]+)\b/u;
const REQUEST_NUMBER_PATTERN = /\b[Cc]-\d{5}-\d{4}-\d{6}\b/u;
const STREET_LINE_PATTERN =
  /^(?<streetNumber>\d+(?:\/\d+)?\s*(?:bis|ter|quater)?|[0-9]+[A-Z]?)\s+(?<streetType>rue|avenue|av\.?|boulevard|bd\.?|place|chemin|route|all[ée]e|impasse|quai|cour|cours)\s+(?<streetName>.+)$/iu;

export function classifyDocument(fullText: string): DocumentClassification {
  const normalized = normalizeForMatch(fullText);
  if (/NOTIFICATION\s+D.?UNE\s+DECISION/u.test(normalized)) {
    return { documentType: 'DECISION_NOTIFICATION', confidence: 0.95 };
  }
  if (normalized.includes("DECISION D'AIDE JURIDICTIONNELLE")) {
    return { documentType: 'AID_DECISION', confidence: 0.95 };
  }
  if (
    normalized.includes('DEMANDE DE PIECES OU INFORMATIONS COMPLEMENTAIRES') ||
    normalized.includes('DEMANDE DE PIECES')
  ) {
    return { documentType: 'REQUEST_MISSING_PARTS', confidence: 0.9 };
  }
  return { documentType: 'UNKNOWN', confidence: 0.2 };
}

export function extractRequestNumber(fullText: string): ExtractedField<string> | undefined {
  const requestNumber = matchField(fullText, REQUEST_NUMBER_PATTERN, 1, 'REGEX', 0.99);
  if (!requestNumber) return undefined;
  return {
    ...requestNumber,
    value: requestNumber.value.toUpperCase(),
  };
}

export function extractJurisdiction(firstPage: PdfPageText): ExtractedField<string> | undefined {
  const lines = firstPage.items.length > 0 ? columnLines(firstPage, 'left') : firstPage.lines;
  const line = lines.find((candidate) =>
    /(Tribunal judiciaire de [A-ZÀ-Ÿa-zà-ÿ' -]+|Conseil de Prud.?hommes de [A-ZÀ-Ÿa-zà-ÿ' -]+)/iu.test(
      candidate,
    ),
  );
  const value = line?.match(
    /(Tribunal judiciaire de [A-ZÀ-Ÿa-zà-ÿ' -]+|Conseil de Prud.?hommes de [A-ZÀ-Ÿa-zà-ÿ' -]+)/iu,
  )?.[0];
  if (!value) return undefined;
  return field(value, firstPage.pageNumber, line, 'LAYOUT', 0.98);
}

export function extractService(firstPage: PdfPageText): ExtractedField<string> | undefined {
  const lines = firstPage.items.length > 0 ? columnLines(firstPage, 'left') : firstPage.lines;
  const line = lines.find((candidate) =>
    /(Bureau d.?aide juridictionnelle|Service du procureur de la République)/iu.test(candidate),
  );
  if (!line) return undefined;
  const service = /Service du procureur de la République/iu.test(line)
    ? 'Service du procureur de la République'
    : "Bureau d'aide juridictionnelle";
  return field(service, firstPage.pageNumber, line, 'LAYOUT', 0.98);
}

export function extractSender(firstPage: PdfPageText): ExtractedSender | undefined {
  const leftLines = columnLines(firstPage, 'left').slice(0, 8);
  const jurisdiction = extractJurisdiction({ ...firstPage, lines: leftLines });
  const service = extractService({ ...firstPage, lines: leftLines });
  const phoneLine = leftLines.find((line) => /T[ée]l[ée]phone\s*:/iu.test(line));
  const phone = phoneLine?.match(/T[ée]l[ée]phone\s*:\s*(?<phone>[+()\d .-]+)/iu)?.groups?.phone;
  const addressLines = leftLines.filter(
    (line) =>
      !/Tribunal judiciaire/iu.test(line) &&
      !/Bureau d.?aide juridictionnelle/iu.test(line) &&
      !/Service du procureur de la République/iu.test(line) &&
      !/T[ée]l[ée]phone\s*:/iu.test(line) &&
      !/^\w+,\s+le\b/iu.test(line),
  );

  if (!jurisdiction && !service && addressLines.length === 0 && !phone) return undefined;

  const sender: ExtractedSender = {
    addressLines: field(addressLines, firstPage.pageNumber, addressLines.join('\n'), 'LAYOUT', 0.8),
  };
  if (jurisdiction) sender.jurisdiction = jurisdiction;
  if (service) sender.service = service;
  if (phone)
    sender.phone = field(phone.trim(), firstPage.pageNumber, phoneLine ?? phone, 'REGEX', 0.95);

  return sender;
}

export function extractRecipient(firstPage: PdfPageText): ExtractedRecipient | undefined {
  const rightLines = recipientColumnLines(firstPage);
  const startIndex = recipientStartIndex(rightLines);
  if (startIndex < 0) return undefined;

  const candidateLines = rightLines.slice(startIndex, startIndex + 10);
  const stopIndex = recipientStopIndex(candidateLines);
  const recipientLines = (stopIndex >= 0 ? candidateLines.slice(0, stopIndex) : candidateLines)
    .map((line) => line.replace(/^repr[ée]sent[ée](?:\(e\))?\s+par,?$/iu, '').trim())
    .filter(Boolean);

  if (recipientLines.length === 0) return undefined;

  const firstLine = recipientLines[0];
  const nameMatch = firstLine?.match(/^(?<civility>Madame|Monsieur|Mademoiselle)\s+(?<name>.+)$/iu);
  const postalLine = recipientLines.find((line) => POSTAL_CITY_PATTERN.test(line));
  const postalMatch = postalLine?.match(POSTAL_CITY_PATTERN);
  const addressLines = recipientLines.slice(nameMatch ? 1 : 0);
  const addressParts = extractAddressParts(addressLines, firstPage.pageNumber);

  const recipient: ExtractedRecipient = {
    addressLines: field(
      addressLines,
      firstPage.pageNumber,
      addressLines.join('\n'),
      'LAYOUT',
      0.85,
    ),
  };
  if (nameMatch?.groups?.civility) {
    recipient.civility = field(
      nameMatch.groups.civility,
      firstPage.pageNumber,
      firstLine ?? '',
      'LAYOUT',
      0.95,
    );
  }
  if (nameMatch?.groups?.name) {
    recipient.fullName = field(
      nameMatch.groups.name.trim(),
      firstPage.pageNumber,
      firstLine ?? '',
      'LAYOUT',
      0.92,
    );
  } else if (firstLine) {
    recipient.fullName = field(firstLine, firstPage.pageNumber, firstLine, 'LAYOUT', 0.7);
  }
  const organization = findOrganization(recipientLines, firstPage.pageNumber);
  if (organization) recipient.organization = organization;
  if (addressParts.streetLine) recipient.streetLine = addressParts.streetLine;
  if (addressParts.streetNumber) recipient.streetNumber = addressParts.streetNumber;
  if (addressParts.streetType) recipient.streetType = addressParts.streetType;
  if (addressParts.streetName) recipient.streetName = addressParts.streetName;
  if (addressParts.addressComplement) recipient.addressComplement = addressParts.addressComplement;
  if (postalMatch?.groups?.postalCode) {
    recipient.postalCode = field(
      postalMatch.groups.postalCode,
      firstPage.pageNumber,
      postalLine ?? '',
      'REGEX',
      0.95,
    );
  }
  if (postalMatch?.groups?.city) {
    recipient.city = field(
      postalMatch.groups.city.trim(),
      firstPage.pageNumber,
      postalLine ?? '',
      'REGEX',
      0.9,
    );
  }

  return recipient;
}

export function extractDates(fullText: string): {
  letterDate?: ExtractedField<string>;
  requestDate?: ExtractedField<string>;
  decisionDate?: ExtractedField<string>;
} {
  const dates: {
    letterDate?: ExtractedField<string>;
    requestDate?: ExtractedField<string>;
    decisionDate?: ExtractedField<string>;
  } = {};
  const letterDate = matchField(
    fullText,
    /\b[A-ZÀ-Ÿa-zà-ÿ' -]+,\s+le\s+(?<value>\d{1,2}\s+[A-ZÀ-Ÿa-zà-ÿ]+\s+\d{4})/u,
    1,
    'REGEX',
    0.9,
  );
  const requestDate = matchField(
    fullText,
    /Date de la demande\s*:\s*(?<value>\d{1,2}\s+[A-ZÀ-Ÿa-zà-ÿ]+\s+\d{4})/u,
    1,
    'REGEX',
    0.95,
  );
  const decisionDate = matchField(
    fullText,
    /Date d[ée]cision\s*:\s*(?<value>\d{1,2}\s+[A-ZÀ-Ÿa-zà-ÿ]+\s+\d{4})/u,
    1,
    'REGEX',
    0.95,
  );
  if (letterDate) dates.letterDate = letterDate;
  if (requestDate) dates.requestDate = requestDate;
  if (decisionDate) dates.decisionDate = decisionDate;

  return dates;
}

export function buildValidation(
  extraction: PdfTextExtraction,
  issues: ValidationIssue[],
): {
  status: ValidationStatus;
  score: number;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
} {
  const firstPage = extraction.metrics[0];

  if (!firstPage || firstPage.characterCount < 100 || firstPage.wordCount < 20) {
    const failureIssues: ValidationIssue[] = [
      ...issues,
      {
        code: 'TEXT_EXTRACTION_FAILED',
        message: 'La première page ne contient pas assez de texte exploitable.',
        severity: 'error',
      },
    ];
    return {
      status: 'TEXT_EXTRACTION_FAILED',
      score: 0,
      issues: failureIssues,
      errors: failureIssues.filter((issue) => issue.severity === 'error'),
      warnings: failureIssues.filter((issue) => issue.severity === 'warning'),
    };
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const score = Math.max(0, 1 - errors.length * 0.25 - warnings.length * 0.1);

  return {
    status: errors.length > 0 || warnings.length > 0 ? 'PARTIAL' : 'OK',
    score,
    issues,
    errors,
    warnings,
  };
}

export function missingIssue(code: ValidationIssueCode, label: string): ValidationIssue {
  return {
    code,
    message: `${label} non extrait.`,
    severity: 'warning',
  };
}

function columnLines(page: PdfPageText, side: 'left' | 'right'): string[] {
  const midpoint = page.width * 0.5;
  const topLimit = page.height * 0.45;
  const items = page.items.filter((item) => {
    const inColumn = side === 'left' ? item.x < midpoint : item.x >= midpoint;
    return inColumn && item.y >= topLimit;
  });
  return buildLines(items);
}

function recipientColumnLines(page: PdfPageText): string[] {
  const items = page.items.filter((item) => {
    const inRightColumn = item.x >= page.width * 0.45;
    const inHeaderZone = item.y >= page.height * 0.45 && item.y <= page.height * 0.9;
    return inRightColumn && inHeaderZone;
  });

  return buildLines(items)
    .map(normalizeSpaces)
    .filter(Boolean)
    .filter((line) => !/^A RAPPELER DANS TOUTE CORRESPONDANCE$/iu.test(line));
}

function recipientStartIndex(lines: string[]): number {
  const civilityIndex = lines.findIndex((line) => CIVILITY_PATTERN.test(line));
  if (civilityIndex >= 0) return civilityIndex;

  return lines.findIndex((line, index) => {
    if (isRecipientNoiseLine(line)) return false;
    const previousLines = lines.slice(0, index);
    return previousLines.some((previousLine) => isSenderHeaderLine(previousLine));
  });
}

function recipientStopIndex(lines: string[]): number {
  const postalIndex = lines.findIndex((line) => POSTAL_CITY_PATTERN.test(line));
  if (postalIndex >= 0) return postalIndex + 1;

  return lines.findIndex(
    (line, index) =>
      index > 0 &&
      (/^Num[ée]ro de la demande/iu.test(line) ||
        /^(Lille|Fait|Le)\b.*\d{4}/iu.test(line) ||
        /^(NOTIFICATION|DEMANDE|DECISION|AVIS)\b/iu.test(line)),
  );
}

function isRecipientNoiseLine(line: string): boolean {
  if (/^(Lille|Fait|Le)\b.*\d{4}/iu.test(line)) return true;
  if (/^MAQ|^PTS_/iu.test(line)) return true;
  if (isSenderHeaderLine(line)) return true;
  return false;
}

function isSenderHeaderLine(line: string): boolean {
  const compact = normalizeForMatch(line).replace(/\s+/gu, '');
  return (
    compact.includes('TRIBUNALJUDICIAIRE') ||
    compact.includes('BUREAUDAIDEJURIDICTIONNELLE') ||
    compact.includes('CONSEILDEPRUDHOMMES') ||
    compact.includes('PALAISDEJUSTICE') ||
    compact.includes('AVENUEDUPEUPLEBELGE') ||
    compact.includes('BP729') ||
    compact.includes('59034LILLE') ||
    compact.includes('59800LILLE')
  );
}

function extractAddressParts(
  addressLines: string[],
  pageNumber: number,
): {
  streetLine?: ExtractedField<string>;
  streetNumber?: ExtractedField<string>;
  streetType?: ExtractedField<string>;
  streetName?: ExtractedField<string>;
  addressComplement?: ExtractedField<string[]>;
} {
  const streetLine = addressLines.find((line) => STREET_LINE_PATTERN.test(line));
  const streetMatch = streetLine?.match(STREET_LINE_PATTERN);
  const postalIndex = addressLines.findIndex((line) => POSTAL_CITY_PATTERN.test(line));
  const streetIndex = streetLine ? addressLines.indexOf(streetLine) : -1;
  const complementLines = addressLines.filter((line, index) => {
    if (index === streetIndex || index === postalIndex) return false;
    if (CIVILITY_PATTERN.test(line)) return false;
    if (STREET_LINE_PATTERN.test(line)) return false;
    return !POSTAL_CITY_PATTERN.test(line);
  });
  const parts: {
    streetLine?: ExtractedField<string>;
    streetNumber?: ExtractedField<string>;
    streetType?: ExtractedField<string>;
    streetName?: ExtractedField<string>;
    addressComplement?: ExtractedField<string[]>;
  } = {};

  if (streetLine) parts.streetLine = field(streetLine, pageNumber, streetLine, 'REGEX', 0.9);
  if (streetMatch?.groups?.streetNumber) {
    parts.streetNumber = field(
      streetMatch.groups.streetNumber.trim(),
      pageNumber,
      streetLine ?? '',
      'REGEX',
      0.9,
    );
  }
  if (streetMatch?.groups?.streetType) {
    parts.streetType = field(
      streetMatch.groups.streetType.trim(),
      pageNumber,
      streetLine ?? '',
      'REGEX',
      0.85,
    );
  }
  if (streetMatch?.groups?.streetName) {
    parts.streetName = field(
      streetMatch.groups.streetName.trim(),
      pageNumber,
      streetLine ?? '',
      'REGEX',
      0.85,
    );
  }
  if (complementLines.length > 0) {
    parts.addressComplement = field(
      complementLines,
      pageNumber,
      complementLines.join('\n'),
      'HEURISTIC',
      0.75,
    );
  }

  return parts;
}

function findOrganization(lines: string[], pageNumber: number): ExtractedField<string> | undefined {
  const line = lines.find(
    (candidate, index) =>
      index > 0 && !CIVILITY_PATTERN.test(candidate) && !POSTAL_CITY_PATTERN.test(candidate),
  );
  if (!line || /^\d/u.test(line)) return undefined;
  return field(line, pageNumber, line, 'HEURISTIC', 0.6);
}

function matchField(
  text: string,
  pattern: RegExp,
  sourcePage: number,
  method: ExtractionMethod,
  confidence: number,
): ExtractedField<string> | undefined {
  const match = text.match(pattern);
  const value = match?.groups?.value ?? match?.[0];
  if (!value) return undefined;
  return field(value.trim(), sourcePage, match?.[0] ?? value, method, confidence);
}

function field<T>(
  value: T,
  sourcePage: number,
  sourceText: string,
  method: ExtractionMethod,
  confidence: number,
): ExtractedField<T> {
  return {
    value,
    confidence,
    sourcePage,
    sourceText: normalizeSpaces(sourceText),
    method,
  };
}

function normalizeForMatch(value: string): string {
  return normalizeSpaces(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase();
}
