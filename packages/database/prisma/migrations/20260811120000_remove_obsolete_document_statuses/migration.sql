/*
  Migration warning:

  - The enum values removed by this migration cannot be preserved if they are still used by rows in
    the `documents` table. The migration will fail instead of silently rewriting those statuses.
*/

BEGIN;

CREATE TYPE "document_status_new" AS ENUM (
  'RECEIVED',
  'STORED',
  'STORAGE_FAILED',
  'ANALYZING',
  'ANALYSIS_FAILED',
  'NON_COMPLIANT',
  'EXTRACTING',
  'GENERATING_AFNOR',
  'CORRECTED',
  'COMPLIANT',
  'QUEUED',
  'SUBMITTING',
  'SUBMITTED',
  'SUBMISSION_FAILED',
  'REJECTED',
  'PURGED'
);

ALTER TABLE "documents" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "documents"
  ALTER COLUMN "status" TYPE "document_status_new"
  USING ("status"::text::"document_status_new");
ALTER TYPE "document_status" RENAME TO "document_status_old";
ALTER TYPE "document_status_new" RENAME TO "document_status";
DROP TYPE "document_status_old";
ALTER TABLE "documents" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

COMMIT;
