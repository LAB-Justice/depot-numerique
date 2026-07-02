import type { DocumentType, PdfExtractionResult, ValidationStatus } from './types.js';

interface EvaluationFileMetadata {
  fileName: string;
  relativePath: string;
  sourceFolder: string;
  fileSizeBytes: number;
  fileHash: string;
}

interface SuccessfulEvaluationRecord extends EvaluationFileMetadata {
  ok: true;
  processingTimeMs: number;
  result: PdfExtractionResult;
}

interface FailedEvaluationRecord extends EvaluationFileMetadata {
  ok: false;
  processingTimeMs: number;
  errorMessage: string;
}

export type EvaluationRecord = SuccessfulEvaluationRecord | FailedEvaluationRecord;

export interface EvaluationReportOptions {
  includeValues?: boolean;
  reviewLimit?: number;
  totalProcessingTimeMs: number;
  inputDirectory: string;
  runId: string;
}

export interface EvaluationReports {
  summaryMd: string;
  documentsCsv: string;
  issuesCsv: string;
  failuresCsv: string;
  byDocumentTypeCsv: string;
  bySourceFolderCsv: string;
  samplesToReviewCsv: string;
  rawResultsJsonl: string;
}

interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

type CsvValue = string | number | boolean | null | undefined;

type StatusCounts = Record<ValidationStatus, number>;

const VALIDATION_STATUSES: ValidationStatus[] = ['OK', 'PARTIAL', 'TEXT_EXTRACTION_FAILED'];
const DOCUMENT_TYPES: DocumentType[] = [
  'REQUEST_MISSING_PARTS',
  'DECISION_NOTIFICATION',
  'AID_DECISION',
  'UNKNOWN',
];

export function buildEvaluationReports(
  records: EvaluationRecord[],
  options: EvaluationReportOptions,
): EvaluationReports {
  const reviewRows = buildSamplesToReview(records, options.reviewLimit ?? 50);

  return {
    summaryMd: buildSummaryMarkdown(records, reviewRows, options),
    documentsCsv: buildDocumentsCsv(records, Boolean(options.includeValues)),
    issuesCsv: buildIssuesCsv(records),
    failuresCsv: buildFailuresCsv(records, Boolean(options.includeValues)),
    byDocumentTypeCsv: buildByDocumentTypeCsv(records),
    bySourceFolderCsv: buildBySourceFolderCsv(records, Boolean(options.includeValues)),
    samplesToReviewCsv: buildSamplesToReviewCsv(reviewRows, Boolean(options.includeValues)),
    rawResultsJsonl: buildRawResultsJsonl(records),
  };
}

export function buildDocumentsCsv(records: EvaluationRecord[], includeValues = false): string {
  const baseColumns: CsvColumn<EvaluationRecord>[] = [
    { header: 'fileName', value: (record) => displayIdentifier(record.fileName, includeValues) },
    {
      header: 'relativePath',
      value: (record) => displayIdentifier(record.relativePath, includeValues),
    },
    {
      header: 'sourceFolder',
      value: (record) => displayIdentifier(record.sourceFolder, includeValues),
    },
    { header: 'fileSizeBytes', value: (record) => record.fileSizeBytes },
    { header: 'fileHash', value: (record) => record.fileHash },
    { header: 'status', value: (record) => extractionStatus(record) },
    {
      header: 'documentType',
      value: (record) => resultValue(record, (result) => result.documentType),
    },
    {
      header: 'documentTypeConfidence',
      value: (record) =>
        resultValue(record, (result) => formatNumber(result.documentTypeConfidence)),
    },
    {
      header: 'validationScore',
      value: (record) => resultValue(record, (result) => formatNumber(result.validation.score)),
    },
    {
      header: 'overallConfidence',
      value: (record) => resultValue(record, (result) => formatNumber(result.confidence.overall)),
    },
    {
      header: 'recipientConfidence',
      value: (record) =>
        resultValue(record, (result) => formatOptionalNumber(result.confidence.recipient)),
    },
    {
      header: 'recipientCompleteness',
      value: (record) =>
        resultValue(record, (result) => formatNumber(result.completeness.recipient)),
    },
    {
      header: 'pageCount',
      value: (record) => resultValue(record, (result) => result.pages.length),
    },
    {
      header: 'pageOneCharacters',
      value: (record) => resultValue(record, (result) => result.pages[0]?.characterCount ?? ''),
    },
    {
      header: 'pageOneWords',
      value: (record) => resultValue(record, (result) => result.pages[0]?.wordCount ?? ''),
    },
    { header: 'hasJurisdiction', value: (record) => hasResultField(record, 'jurisdiction') },
    { header: 'hasService', value: (record) => hasResultField(record, 'service') },
    { header: 'hasRequestNumber', value: (record) => hasResultField(record, 'requestNumber') },
    {
      header: 'hasRecipient',
      value: (record) => resultValue(record, (result) => Boolean(result.recipient)),
    },
    {
      header: 'hasRecipientName',
      value: (record) =>
        resultValue(record, (result) =>
          Boolean(result.recipient?.fullName ?? result.recipient?.organization),
        ),
    },
    {
      header: 'hasOrganization',
      value: (record) => resultValue(record, (result) => Boolean(result.recipient?.organization)),
    },
    {
      header: 'hasAddressLines',
      value: (record) =>
        resultValue(record, (result) => Boolean(result.recipient?.addressLines.value.length)),
    },
    {
      header: 'hasStreetLine',
      value: (record) => resultValue(record, (result) => Boolean(result.recipient?.streetLine)),
    },
    {
      header: 'hasPostalCode',
      value: (record) => resultValue(record, (result) => Boolean(result.recipient?.postalCode)),
    },
    {
      header: 'hasCity',
      value: (record) => resultValue(record, (result) => Boolean(result.recipient?.city)),
    },
    {
      header: 'issueCodes',
      value: (record) =>
        resultValue(record, (result) =>
          result.validation.issues.map((issue) => issue.code).join(';'),
        ),
    },
    { header: 'processingTimeMs', value: (record) => Math.round(record.processingTimeMs) },
    { header: 'technicalError', value: (record) => (record.ok ? '' : record.errorMessage) },
  ];

  const sensitiveColumns: CsvColumn<EvaluationRecord>[] = [
    {
      header: 'recipientName',
      value: (record) => resultValue(record, (result) => result.recipient?.fullName?.value ?? ''),
    },
    {
      header: 'organization',
      value: (record) =>
        resultValue(record, (result) => result.recipient?.organization?.value ?? ''),
    },
    {
      header: 'streetLine',
      value: (record) => resultValue(record, (result) => result.recipient?.streetLine?.value ?? ''),
    },
    {
      header: 'postalCode',
      value: (record) => resultValue(record, (result) => result.recipient?.postalCode?.value ?? ''),
    },
    {
      header: 'city',
      value: (record) => resultValue(record, (result) => result.recipient?.city?.value ?? ''),
    },
    {
      header: 'requestNumber',
      value: (record) => resultValue(record, (result) => result.requestNumber?.value ?? ''),
    },
    {
      header: 'jurisdiction',
      value: (record) => resultValue(record, (result) => result.jurisdiction?.value ?? ''),
    },
    {
      header: 'service',
      value: (record) => resultValue(record, (result) => result.service?.value ?? ''),
    },
  ];

  return toCsv(records, includeValues ? [...baseColumns, ...sensitiveColumns] : baseColumns);
}

export function buildSamplesToReview(
  records: EvaluationRecord[],
  limit: number,
): Array<{
  record: EvaluationRecord;
  priorityScore: number;
  reasons: string[];
}> {
  return records
    .map((record) => ({ record, ...priorityFor(record) }))
    .filter((row) => row.priorityScore > 0)
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return a.record.relativePath.localeCompare(b.record.relativePath);
    })
    .slice(0, limit);
}

function buildSummaryMarkdown(
  records: EvaluationRecord[],
  reviewRows: ReturnType<typeof buildSamplesToReview>,
  options: EvaluationReportOptions,
): string {
  const successful = successfulRecords(records);
  const failures = failedRecords(records);
  const statusCounts = countStatuses(successful);
  const documentTypeCounts = countBy(successful, (record) => record.result.documentType);
  const issueRows = aggregateIssues(successful).slice(0, 10);
  const unknownCount = successful.filter(
    (record) => record.result.documentType === 'UNKNOWN',
  ).length;
  const withoutCompleteRecipient = successful.filter(
    (record) => record.result.completeness.recipient < 1,
  ).length;
  const withoutPostalCode = successful.filter(
    (record) => !record.result.recipient?.postalCode,
  ).length;
  const withoutCity = successful.filter((record) => !record.result.recipient?.city).length;
  const withoutRequestNumber = successful.filter((record) => !record.result.requestNumber).length;
  const averageProcessingTime =
    records.length > 0 ? options.totalProcessingTimeMs / records.length : 0;
  const recipientCompletenessBuckets = bucketRecipientCompleteness(successful);

  const lines = [
    '# Evaluation corpus PDF',
    '',
    `Run: ${options.runId}`,
    `Dossier source: ${options.inputDirectory}`,
    '',
    '## Synthese',
    '',
    `- PDF total: ${records.length}`,
    `- Documents traites avec succes: ${successful.length}`,
    `- Erreurs techniques: ${failures.length}`,
    `- Documents UNKNOWN: ${unknownCount}`,
    `- Documents sans destinataire complet: ${withoutCompleteRecipient}`,
    `- Documents sans code postal: ${withoutPostalCode}`,
    `- Documents sans ville: ${withoutCity}`,
    `- Documents sans requestNumber: ${withoutRequestNumber}`,
    `- Temps total: ${Math.round(options.totalProcessingTimeMs)} ms`,
    `- Temps moyen par PDF: ${formatNumber(averageProcessingTime)} ms`,
    '',
    '## Validation status',
    '',
    ...VALIDATION_STATUSES.map(
      (status) =>
        `- ${status}: ${statusCounts[status]} (${percent(statusCounts[status], successful.length)})`,
    ),
    '',
    '## Types de documents',
    '',
    ...DOCUMENT_TYPES.map((documentType) => {
      const count = documentTypeCounts.get(documentType) ?? 0;
      return `- ${documentType}: ${count} (${percent(count, successful.length)})`;
    }),
    '',
    '## Completeness recipient',
    '',
    ...recipientCompletenessBuckets.map((bucket) => `- ${bucket.label}: ${bucket.count}`),
    '',
    '## Top issues',
    '',
    ...(issueRows.length > 0
      ? issueRows.map(
          (issue) => `- ${issue.issueCode} (${issue.severity}): ${issue.count} (${issue.percent})`,
        )
      : ['- Aucune issue']),
    '',
    '## Fichiers prioritaires a revoir',
    '',
    ...(reviewRows.length > 0
      ? reviewRows
          .slice(0, 10)
          .map(
            (row) =>
              `- ${displayIdentifier(row.record.relativePath, Boolean(options.includeValues))} - score ${row.priorityScore} - hash ${row.record.fileHash.slice(0, 12)} - ${row.reasons.join('; ')}`,
          )
      : ['- Aucun fichier prioritaire']),
    '',
    '## Confidentialite',
    '',
    '- Les CSV et ce resume n incluent pas de valeurs extraites par defaut.',
    '- Les references numeriques dans les noms de fichiers et chemins sont masquees par defaut.',
    '- raw-results.jsonl contient le resultat complet local de extractPdfDocument et peut contenir des donnees sensibles.',
    '- Utiliser --include-values uniquement pour un diagnostic local explicite.',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function buildIssuesCsv(records: EvaluationRecord[]): string {
  return toCsv(aggregateIssues(successfulRecords(records)), [
    { header: 'issueCode', value: (row) => row.issueCode },
    { header: 'severity', value: (row) => row.severity },
    { header: 'count', value: (row) => row.count },
    { header: 'percent', value: (row) => row.percent },
  ]);
}

function buildFailuresCsv(records: EvaluationRecord[], includeValues: boolean): string {
  return toCsv(failedRecords(records), [
    { header: 'fileName', value: (record) => displayIdentifier(record.fileName, includeValues) },
    {
      header: 'relativePath',
      value: (record) => displayIdentifier(record.relativePath, includeValues),
    },
    {
      header: 'sourceFolder',
      value: (record) => displayIdentifier(record.sourceFolder, includeValues),
    },
    { header: 'errorMessage', value: (record) => record.errorMessage },
    { header: 'processingTimeMs', value: (record) => Math.round(record.processingTimeMs) },
  ]);
}

function buildByDocumentTypeCsv(records: EvaluationRecord[]): string {
  const successful = successfulRecords(records);
  const rows = DOCUMENT_TYPES.map((documentType) => {
    const matching = successful.filter((record) => record.result.documentType === documentType);
    return {
      documentType,
      count: matching.length,
      percent: percent(matching.length, successful.length),
      okCount: matching.filter((record) => record.result.validation.status === 'OK').length,
      partialCount: matching.filter((record) => record.result.validation.status === 'PARTIAL')
        .length,
      textExtractionFailedCount: matching.filter(
        (record) => record.result.validation.status === 'TEXT_EXTRACTION_FAILED',
      ).length,
      averageValidationScore: average(matching, (record) => record.result.validation.score),
      averageRecipientCompleteness: average(
        matching,
        (record) => record.result.completeness.recipient,
      ),
    };
  }).filter((row) => row.count > 0);

  return toCsv(rows, [
    { header: 'documentType', value: (row) => row.documentType },
    { header: 'count', value: (row) => row.count },
    { header: 'percent', value: (row) => row.percent },
    { header: 'okCount', value: (row) => row.okCount },
    { header: 'partialCount', value: (row) => row.partialCount },
    { header: 'textExtractionFailedCount', value: (row) => row.textExtractionFailedCount },
    { header: 'averageValidationScore', value: (row) => formatNumber(row.averageValidationScore) },
    {
      header: 'averageRecipientCompleteness',
      value: (row) => formatNumber(row.averageRecipientCompleteness),
    },
  ]);
}

function buildBySourceFolderCsv(records: EvaluationRecord[], includeValues: boolean): string {
  const folderMap = new Map<string, EvaluationRecord[]>();
  for (const record of records) {
    const sourceFolder = displayIdentifier(record.sourceFolder, includeValues);
    const folderRecords = folderMap.get(sourceFolder) ?? [];
    folderRecords.push(record);
    folderMap.set(sourceFolder, folderRecords);
  }

  const rows = [...folderMap.entries()]
    .map(([sourceFolder, folderRecords]) => {
      const successful = successfulRecords(folderRecords);
      const statusCounts = countStatuses(successful);
      return {
        sourceFolder,
        count: folderRecords.length,
        okCount: statusCounts.OK,
        partialCount: statusCounts.PARTIAL,
        textExtractionFailedCount: statusCounts.TEXT_EXTRACTION_FAILED,
        unknownCount: successful.filter((record) => record.result.documentType === 'UNKNOWN')
          .length,
        averageValidationScore: average(successful, (record) => record.result.validation.score),
        averageRecipientCompleteness: average(
          successful,
          (record) => record.result.completeness.recipient,
        ),
      };
    })
    .sort((a, b) => b.count - a.count || a.sourceFolder.localeCompare(b.sourceFolder));

  return toCsv(rows, [
    { header: 'sourceFolder', value: (row) => row.sourceFolder },
    { header: 'count', value: (row) => row.count },
    { header: 'okCount', value: (row) => row.okCount },
    { header: 'partialCount', value: (row) => row.partialCount },
    { header: 'textExtractionFailedCount', value: (row) => row.textExtractionFailedCount },
    { header: 'unknownCount', value: (row) => row.unknownCount },
    { header: 'averageValidationScore', value: (row) => formatNumber(row.averageValidationScore) },
    {
      header: 'averageRecipientCompleteness',
      value: (row) => formatNumber(row.averageRecipientCompleteness),
    },
  ]);
}

function buildSamplesToReviewCsv(
  reviewRows: ReturnType<typeof buildSamplesToReview>,
  includeValues: boolean,
): string {
  return toCsv(reviewRows, [
    {
      header: 'fileName',
      value: (row) => displayIdentifier(row.record.fileName, includeValues),
    },
    {
      header: 'relativePath',
      value: (row) => displayIdentifier(row.record.relativePath, includeValues),
    },
    {
      header: 'sourceFolder',
      value: (row) => displayIdentifier(row.record.sourceFolder, includeValues),
    },
    { header: 'fileHash', value: (row) => row.record.fileHash },
    { header: 'priorityScore', value: (row) => row.priorityScore },
    { header: 'reasons', value: (row) => row.reasons.join(';') },
    { header: 'status', value: (row) => extractionStatus(row.record) },
    {
      header: 'documentType',
      value: (row) => resultValue(row.record, (result) => result.documentType),
    },
    {
      header: 'validationScore',
      value: (row) => resultValue(row.record, (result) => formatNumber(result.validation.score)),
    },
    {
      header: 'overallConfidence',
      value: (row) => resultValue(row.record, (result) => formatNumber(result.confidence.overall)),
    },
    {
      header: 'recipientCompleteness',
      value: (row) =>
        resultValue(row.record, (result) => formatNumber(result.completeness.recipient)),
    },
    { header: 'technicalError', value: (row) => (row.record.ok ? '' : row.record.errorMessage) },
  ]);
}

function buildRawResultsJsonl(records: EvaluationRecord[]): string {
  return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
}

function aggregateIssues(records: SuccessfulEvaluationRecord[]): Array<{
  issueCode: string;
  severity: string;
  count: number;
  percent: string;
}> {
  const total = records.length;
  const counts = new Map<string, { severity: string; count: number }>();
  for (const record of records) {
    for (const issue of record.result.validation.issues) {
      const existing = counts.get(issue.code) ?? { severity: issue.severity, count: 0 };
      existing.count += 1;
      counts.set(issue.code, existing);
    }
  }

  return [...counts.entries()]
    .map(([issueCode, value]) => ({
      issueCode,
      severity: value.severity,
      count: value.count,
      percent: percent(value.count, total),
    }))
    .sort((a, b) => b.count - a.count || a.issueCode.localeCompare(b.issueCode));
}

function priorityFor(record: EvaluationRecord): { priorityScore: number; reasons: string[] } {
  if (!record.ok) {
    return {
      priorityScore: 5000,
      reasons: ['TECHNICAL_ERROR'],
    };
  }

  let score = 0;
  const reasons: string[] = [];
  const result = record.result;
  const issueCodes = new Set(result.validation.issues.map((issue) => issue.code));

  if (result.validation.status === 'TEXT_EXTRACTION_FAILED') {
    score += 900;
    reasons.push('TEXT_EXTRACTION_FAILED');
  }
  if (result.documentType === 'UNKNOWN') {
    score += 700;
    reasons.push('UNKNOWN_DOCUMENT_TYPE');
  }
  if (result.completeness.recipient < 1) {
    score += 400 + Math.round((1 - result.completeness.recipient) * 100);
    reasons.push('RECIPIENT_INCOMPLETE');
  }
  if ([...issueCodes].some((code) => code.startsWith('MISSING_RECIPIENT'))) {
    score += 300;
    reasons.push('MISSING_RECIPIENT_FIELD');
  }
  if (issueCodes.has('RECIPIENT_ADDRESS_BLOCK_NAME_MISMATCH')) {
    score += 250;
    reasons.push('RECIPIENT_ADDRESS_BLOCK_NAME_MISMATCH');
  }
  if (result.confidence.overall < 0.5) {
    score += 200 + Math.round((0.5 - result.confidence.overall) * 100);
    reasons.push('LOW_OVERALL_CONFIDENCE');
  }
  if (result.validation.score < 0.7) {
    score += 200 + Math.round((0.7 - result.validation.score) * 100);
    reasons.push('LOW_VALIDATION_SCORE');
  }

  return {
    priorityScore: score,
    reasons,
  };
}

function bucketRecipientCompleteness(records: SuccessfulEvaluationRecord[]): Array<{
  label: string;
  count: number;
}> {
  const buckets = [
    { label: '1.00', count: 0, test: (value: number) => value === 1 },
    { label: '0.75-0.99', count: 0, test: (value: number) => value >= 0.75 && value < 1 },
    { label: '0.50-0.74', count: 0, test: (value: number) => value >= 0.5 && value < 0.75 },
    { label: '0.01-0.49', count: 0, test: (value: number) => value > 0 && value < 0.5 },
    { label: '0.00', count: 0, test: (value: number) => value === 0 },
  ];
  for (const record of records) {
    const bucket = buckets.find((candidate) =>
      candidate.test(record.result.completeness.recipient),
    );
    if (bucket) bucket.count += 1;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}

function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => csvEscape(column.header)).join(',');
  const body = rows.map((row) => columns.map((column) => csvEscape(column.value(row))).join(','));
  return `${[header, ...body].join('\n')}\n`;
}

function csvEscape(value: CsvValue): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r]/u.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function displayIdentifier(value: string, includeValues: boolean): string {
  if (includeValues || value === '.') return value;
  return value
    .replace(/\b[Cc]-\d{5}-\d{4}-\d{6}\b/gu, 'C-[redacted]')
    .replace(/\d{4,}(?:[-_]\d{2,})*/gu, '[num]');
}

function resultValue<T>(
  record: EvaluationRecord,
  getter: (result: PdfExtractionResult) => T,
): T | '' {
  if (!record.ok) return '';
  return getter(record.result);
}

function hasResultField(
  record: EvaluationRecord,
  field: 'jurisdiction' | 'service' | 'requestNumber',
): boolean | '' {
  return resultValue(record, (result) => Boolean(result[field]));
}

function extractionStatus(record: EvaluationRecord): ValidationStatus | 'TECHNICAL_ERROR' {
  return record.ok ? record.result.validation.status : 'TECHNICAL_ERROR';
}

function successfulRecords(records: EvaluationRecord[]): SuccessfulEvaluationRecord[] {
  return records.filter((record): record is SuccessfulEvaluationRecord => record.ok);
}

function failedRecords(records: EvaluationRecord[]): FailedEvaluationRecord[] {
  return records.filter((record): record is FailedEvaluationRecord => !record.ok);
}

function countStatuses(records: SuccessfulEvaluationRecord[]): StatusCounts {
  return {
    OK: records.filter((record) => record.result.validation.status === 'OK').length,
    PARTIAL: records.filter((record) => record.result.validation.status === 'PARTIAL').length,
    TEXT_EXTRACTION_FAILED: records.filter(
      (record) => record.result.validation.status === 'TEXT_EXTRACTION_FAILED',
    ).length,
  };
}

function countBy<T>(
  records: SuccessfulEvaluationRecord[],
  getter: (record: SuccessfulEvaluationRecord) => T,
): Map<T, number> {
  const counts = new Map<T, number>();
  for (const record of records) {
    const key = getter(record);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function average<T>(rows: T[], getter: (row: T) => number): number {
  if (rows.length === 0) return 0;
  return rows.reduce((sum, row) => sum + getter(row), 0) / rows.length;
}

function percent(count: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function formatOptionalNumber(value: number | undefined): string {
  return value === undefined ? '' : formatNumber(value);
}
