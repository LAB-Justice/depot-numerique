import { z } from 'zod';

const documentTypeSchema = z.enum([
  'REQUEST_MISSING_PARTS',
  'DECISION_NOTIFICATION',
  'AID_DECISION',
  'UNKNOWN',
]);

const extractionMethodSchema = z.enum(['REGEX', 'LAYOUT', 'HEURISTIC']);

const validationStatusSchema = z.enum(['OK', 'PARTIAL', 'TEXT_EXTRACTION_FAILED']);

const validationIssueCodeSchema = z.enum([
  'TEXT_EXTRACTION_FAILED',
  'UNKNOWN_DOCUMENT_TYPE',
  'MISSING_JURISDICTION',
  'MISSING_SERVICE',
  'MISSING_REQUEST_NUMBER',
  'MISSING_RECIPIENT',
]);

const validationIssueSchema = z.object({
  code: validationIssueCodeSchema,
  message: z.string(),
  severity: z.enum(['error', 'warning']),
});

const extractedFieldSchema = <T extends z.ZodType>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    confidence: z.number().min(0).max(1),
    sourcePage: z.number().int().positive(),
    sourceText: z.string(),
    method: extractionMethodSchema,
  });

const pageMetricsSchema = z.object({
  pageNumber: z.number().int().positive(),
  characterCount: z.number().int().min(0),
  wordCount: z.number().int().min(0),
  isEmpty: z.boolean(),
});

const validationSchema = z.object({
  status: validationStatusSchema,
  score: z.number().min(0).max(1),
  issues: z.array(validationIssueSchema),
  errors: z.array(validationIssueSchema),
  warnings: z.array(validationIssueSchema),
});

const confidenceSchema = z.object({
  overall: z.number().min(0).max(1),
  recipient: z.number().min(0).max(1).optional(),
  sender: z.number().min(0).max(1).optional(),
  dates: z.number().min(0).max(1).optional(),
});

const pageTextSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string(),
  characterCount: z.number().int().min(0),
  wordCount: z.number().int().min(0),
});

const layoutBlockSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const pdfExtractionResultSchema = z.object({
  documentType: documentTypeSchema,
  documentTypeConfidence: z.number().min(0).max(1),
  jurisdiction: extractedFieldSchema(z.string()).optional(),
  service: extractedFieldSchema(z.string()).optional(),
  requestNumber: extractedFieldSchema(z.string()).optional(),
  recipient: z
    .object({
      civility: extractedFieldSchema(z.string()).optional(),
      fullName: extractedFieldSchema(z.string()).optional(),
      organization: extractedFieldSchema(z.string()).optional(),
      addressLines: extractedFieldSchema(z.array(z.string())),
      streetLine: extractedFieldSchema(z.string()).optional(),
      streetNumber: extractedFieldSchema(z.string()).optional(),
      streetType: extractedFieldSchema(z.string()).optional(),
      streetName: extractedFieldSchema(z.string()).optional(),
      addressComplement: extractedFieldSchema(z.array(z.string())).optional(),
      postalCode: extractedFieldSchema(z.string()).optional(),
      city: extractedFieldSchema(z.string()).optional(),
    })
    .optional(),
  sender: z
    .object({
      jurisdiction: extractedFieldSchema(z.string()).optional(),
      service: extractedFieldSchema(z.string()).optional(),
      addressLines: extractedFieldSchema(z.array(z.string())),
      phone: extractedFieldSchema(z.string()).optional(),
    })
    .optional(),
  dates: z.object({
    letterDate: extractedFieldSchema(z.string()).optional(),
    requestDate: extractedFieldSchema(z.string()).optional(),
    decisionDate: extractedFieldSchema(z.string()).optional(),
  }),
  confidence: confidenceSchema,
  validation: validationSchema,
  pages: z.array(pageMetricsSchema),
  rawText: z.string().optional(),
  pageTexts: z.array(pageTextSchema).optional(),
  layoutBlocks: z.array(layoutBlockSchema).optional(),
});
