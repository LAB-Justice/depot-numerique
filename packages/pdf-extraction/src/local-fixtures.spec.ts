import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractPdfDocument, pdfExtractionResultSchema } from './index.js';

const fixturesDir = join(process.cwd(), '.local-fixtures');
const fixtureFiles = existsSync(fixturesDir)
  ? readdirSync(fixturesDir).filter((file) => file.toLowerCase().endsWith('.pdf'))
  : [];

describe.skipIf(fixtureFiles.length === 0)('local PDF fixtures', () => {
  for (const fixtureFile of fixtureFiles) {
    it(`extracts ${fixtureFile}`, async () => {
      const buffer = readFileSync(join(fixturesDir, fixtureFile));
      const result = await extractPdfDocument(buffer);

      expect(pdfExtractionResultSchema.parse(result)).toEqual(result);
      expect(result.validation.status).not.toBe('TEXT_EXTRACTION_FAILED');
      const expectedRequestNumber = fixtureFile.match(/\bc-\d{5}-\d{4}-\d{6}\b/iu)?.[0];
      if (expectedRequestNumber) {
        expect(result.requestNumber?.value).toBe(expectedRequestNumber.toUpperCase());
      }
    });
  }
});
