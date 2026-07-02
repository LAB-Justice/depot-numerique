import { describe, expect, it } from 'vitest';
import {
  buildDocumentsCsv,
  buildEvaluationReports,
  buildSamplesToReview,
  type EvaluationRecord,
} from './evaluation-report.js';
import type { DocumentType, PdfExtractionResult, ValidationIssue } from './types.js';

const missingRecipientCity: ValidationIssue = {
  code: 'MISSING_RECIPIENT_CITY',
  message: 'Ville du destinataire non extrait.',
  severity: 'warning',
};

const unknownDocumentType: ValidationIssue = {
  code: 'UNKNOWN_DOCUMENT_TYPE',
  message: 'Type de document non reconnu.',
  severity: 'warning',
};

describe('evaluation corpus reports', () => {
  it('keeps documents.csv anonymized by default', () => {
    const csv = buildDocumentsCsv([
      successRecord(buildResult(), {
        fileName: 'sample-document-ref-123456789.pdf',
        relativePath: 'local-corpus/sample-document-ref-123456789.pdf',
        sourceFolder: 'local-corpus',
      }),
    ]);

    expect(csv.split('\n')[0]).toBe(
      [
        'fileName',
        'relativePath',
        'sourceFolder',
        'fileSizeBytes',
        'fileHash',
        'status',
        'documentType',
        'documentTypeConfidence',
        'validationScore',
        'overallConfidence',
        'recipientConfidence',
        'recipientCompleteness',
        'pageCount',
        'pageOneCharacters',
        'pageOneWords',
        'hasJurisdiction',
        'hasService',
        'hasRequestNumber',
        'hasRecipient',
        'hasRecipientName',
        'hasOrganization',
        'hasAddressLines',
        'hasStreetLine',
        'hasPostalCode',
        'hasCity',
        'issueCodes',
        'processingTimeMs',
        'technicalError',
      ].join(','),
    );
    expect(csv).not.toContain('Jeanne Doe');
    expect(csv).not.toContain('00 rue des Exemples');
    expect(csv).not.toContain('C-00000-0000-000001');
    expect(csv).not.toContain('123456789');
    expect(csv).toContain('[num]');
  });

  it('adds sensitive columns only when includeValues is explicit', () => {
    const csv = buildDocumentsCsv(
      [
        successRecord(buildResult(), {
          fileName: 'sample-document-ref-123456789.pdf',
        }),
      ],
      true,
    );

    expect(csv.split('\n')[0]).toContain('recipientName');
    expect(csv).toContain('Jeanne Doe');
    expect(csv).toContain('C-00000-0000-000001');
    expect(csv).toContain('123456789');
  });

  it('aggregates issues, failures, document types and source folders', () => {
    const reports = buildEvaluationReports(
      [
        successRecord(buildResult({ issues: [missingRecipientCity] })),
        successRecord(
          buildResult({
            documentType: 'UNKNOWN',
            issues: [unknownDocumentType],
            score: 0.7,
            recipientCompleteness: 0.5,
          }),
          { relativePath: 'bog/document.pdf', sourceFolder: 'bog' },
        ),
        failureRecord(),
      ],
      {
        totalProcessingTimeMs: 300,
        inputDirectory: '/tmp/corpus',
        runId: '2026-07-02-120000',
      },
    );

    expect(reports.issuesCsv).toContain('MISSING_RECIPIENT_CITY,warning,1,50.0%');
    expect(reports.issuesCsv).toContain('UNKNOWN_DOCUMENT_TYPE,warning,1,50.0%');
    expect(reports.failuresCsv).toContain('parse failed');
    expect(reports.byDocumentTypeCsv).toContain('UNKNOWN,1,50.0%');
    expect(reports.bySourceFolderCsv).toContain('bog,1,0,1,0,1,0.700,0.500');
    expect(reports.summaryMd).toContain('- PDF total: 3');
    expect(reports.summaryMd).toContain('- Erreurs techniques: 1');
  });

  it('prioritizes technical errors and weak extraction signals', () => {
    const rows = buildSamplesToReview(
      [
        successRecord(buildResult()),
        successRecord(
          buildResult({
            documentType: 'UNKNOWN',
            issues: [unknownDocumentType],
            score: 0.4,
            overallConfidence: 0.2,
            recipientCompleteness: 0,
            status: 'TEXT_EXTRACTION_FAILED',
          }),
        ),
        failureRecord(),
      ],
      2,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.reasons).toContain('TECHNICAL_ERROR');
    expect(rows[1]?.reasons).toContain('TEXT_EXTRACTION_FAILED');
  });
});

function successRecord(
  result: PdfExtractionResult,
  overrides: Partial<EvaluationRecord> = {},
): EvaluationRecord {
  return {
    ok: true,
    fileName: 'document.pdf',
    relativePath: 'document.pdf',
    sourceFolder: '.',
    fileSizeBytes: 123,
    fileHash: 'abc123',
    processingTimeMs: 42,
    result,
    ...overrides,
  } as EvaluationRecord;
}

function failureRecord(): EvaluationRecord {
  return {
    ok: false,
    fileName: 'broken.pdf',
    relativePath: 'broken.pdf',
    sourceFolder: '.',
    fileSizeBytes: 456,
    fileHash: 'def456',
    processingTimeMs: 12,
    errorMessage: 'parse failed',
  };
}

function buildResult(
  overrides: {
    documentType?: DocumentType;
    issues?: ValidationIssue[];
    score?: number;
    overallConfidence?: number;
    recipientCompleteness?: number;
    status?: PdfExtractionResult['validation']['status'];
  } = {},
): PdfExtractionResult {
  const issues = overrides.issues ?? [];
  const status = overrides.status ?? (issues.length > 0 ? ('PARTIAL' as const) : ('OK' as const));

  return {
    documentType: overrides.documentType ?? 'REQUEST_MISSING_PARTS',
    documentTypeConfidence: 0.9,
    jurisdiction: {
      value: 'Tribunal judiciaire de Lille',
      confidence: 0.98,
      sourcePage: 1,
      sourceText: 'Tribunal judiciaire de Lille',
      method: 'LAYOUT',
    },
    service: {
      value: "Bureau d'aide juridictionnelle",
      confidence: 0.98,
      sourcePage: 1,
      sourceText: "Bureau d'aide juridictionnelle",
      method: 'LAYOUT',
    },
    requestNumber: {
      value: 'C-00000-0000-000001',
      confidence: 0.99,
      sourcePage: 1,
      sourceText: 'Numéro de la demande : C-00000-0000-000001',
      method: 'REGEX',
    },
    recipient: {
      fullName: {
        value: 'Jeanne Doe',
        confidence: 0.92,
        sourcePage: 1,
        sourceText: 'Madame Jeanne Doe',
        method: 'LAYOUT',
      },
      addressLines: {
        value: ['00 rue des Exemples', '00000 EXEMPLEVILLE'],
        confidence: 0.85,
        sourcePage: 1,
        sourceText: '00 rue des Exemples\n00000 EXEMPLEVILLE',
        method: 'LAYOUT',
      },
      streetLine: {
        value: '00 rue des Exemples',
        confidence: 0.9,
        sourcePage: 1,
        sourceText: '00 rue des Exemples',
        method: 'REGEX',
      },
      postalCode: {
        value: '00000',
        confidence: 0.95,
        sourcePage: 1,
        sourceText: '00000 EXEMPLEVILLE',
        method: 'REGEX',
      },
      city: {
        value: 'EXEMPLEVILLE',
        confidence: 0.9,
        sourcePage: 1,
        sourceText: '00000 EXEMPLEVILLE',
        method: 'REGEX',
      },
    },
    dates: {},
    confidence: {
      overall: overrides.overallConfidence ?? 0.8,
      recipient: 0.9,
    },
    completeness: {
      recipient: overrides.recipientCompleteness ?? 1,
    },
    validation: {
      status,
      score: overrides.score ?? (status === 'OK' ? 1 : 0.8),
      issues,
      errors: issues.filter((issue) => issue.severity === 'error'),
      warnings: issues.filter((issue) => issue.severity === 'warning'),
    },
    pages: [
      {
        pageNumber: 1,
        characterCount: 200,
        wordCount: 40,
        isEmpty: false,
      },
    ],
  };
}
