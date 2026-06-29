-- CreateEnum
CREATE TYPE "mail_type" AS ENUM ('LR', 'LS');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('RECEIVED', 'STORED', 'STORAGE_FAILED', 'ANALYZING', 'ANALYSIS_FAILED', 'NON_COMPLIANT', 'EXTRACTING', 'LLM_PENDING', 'LLM_FAILED', 'GENERATING_AFNOR', 'CORRECTED', 'COMPLIANT', 'QUEUED', 'SUBMITTING', 'SUBMITTED', 'SUBMISSION_FAILED', 'REJECTED', 'PURGED');

-- CreateEnum
CREATE TYPE "document_file_kind" AS ENUM ('ORIGINAL', 'EXTRACTED', 'GENERATED', 'CORRECTED', 'SUBMITTED', 'REJECTED');

-- CreateTable
CREATE TABLE "jurisdictions" (
    "id" UUID NOT NULL,
    "sso_code" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jurisdictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "jurisdiction_id" UUID NOT NULL,
    "sso_code" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "mail_type" "mail_type" NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'RECEIVED',
    "depositor_ref" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_files" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "kind" "document_file_kind" NOT NULL,
    "bucket" VARCHAR(63) NOT NULL,
    "object_key" VARCHAR(1024) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jurisdictions_sso_code_key" ON "jurisdictions"("sso_code");

-- CreateIndex
CREATE UNIQUE INDEX "jurisdictions_slug_key" ON "jurisdictions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "services_jurisdiction_id_sso_code_key" ON "services"("jurisdiction_id", "sso_code");

-- CreateIndex
CREATE UNIQUE INDEX "services_jurisdiction_id_slug_key" ON "services"("jurisdiction_id", "slug");

-- CreateIndex
CREATE INDEX "documents_service_id_created_at_idx" ON "documents"("service_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_status_created_at_idx" ON "documents"("status", "created_at");

-- CreateIndex
CREATE INDEX "documents_depositor_ref_created_at_idx" ON "documents"("depositor_ref", "created_at");

-- CreateIndex
CREATE INDEX "document_files_document_id_kind_idx" ON "document_files"("document_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "document_files_bucket_object_key_key" ON "document_files"("bucket", "object_key");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "jurisdictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
