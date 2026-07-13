/*
  Warnings:

  - You are about to drop the column `depositor_ref` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `jurisdiction_id` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `sso_code` on the `services` table. All the data in the column will be lost.
  - You are about to drop the `jurisdictions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[structure_id,slug]` on the table `services` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `created_by_user_id` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `structure_id` to the `services` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMINISTRATEUR_GENERAL', 'ADMINISTRATEUR_REGIONAL', 'ADMINISTRATEUR_LOCAL', 'AGENT');

-- CreateEnum
CREATE TYPE "structure_level" AS ENUM ('REGIONAL', 'JURISDICTION', 'SUB_JURISDICTION');

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_jurisdiction_id_fkey";

-- DropIndex
DROP INDEX "documents_depositor_ref_created_at_idx";

-- DropIndex
DROP INDEX "services_jurisdiction_id_slug_key";

-- DropIndex
DROP INDEX "services_jurisdiction_id_sso_code_key";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "depositor_ref",
ADD COLUMN     "created_by_user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "services" DROP COLUMN "jurisdiction_id",
DROP COLUMN "sso_code",
ADD COLUMN     "structure_id" UUID NOT NULL;

-- DropTable
DROP TABLE "jurisdictions";

-- CreateTable
CREATE TABLE "structures" (
    "id" UUID NOT NULL,
    "sso_code" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "level" "structure_level" NOT NULL,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "igcid_hash" CHAR(64) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "work_structure_id" UUID,
    "admin_structure_id" UUID,
    "service_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "structures_sso_code_key" ON "structures"("sso_code");

-- CreateIndex
CREATE INDEX "structures_parent_id_idx" ON "structures"("parent_id");

-- CreateIndex
CREATE INDEX "structures_level_idx" ON "structures"("level");

-- CreateIndex
CREATE UNIQUE INDEX "users_igcid_hash_key" ON "users"("igcid_hash");

-- CreateIndex
CREATE INDEX "users_work_structure_id_idx" ON "users"("work_structure_id");

-- CreateIndex
CREATE INDEX "users_admin_structure_id_idx" ON "users"("admin_structure_id");

-- CreateIndex
CREATE INDEX "users_service_id_idx" ON "users"("service_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "documents_created_by_user_id_idx" ON "documents"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "services_structure_id_slug_key" ON "services"("structure_id", "slug");

-- AddForeignKey
ALTER TABLE "structures" ADD CONSTRAINT "structures_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_work_structure_id_fkey" FOREIGN KEY ("work_structure_id") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_admin_structure_id_fkey" FOREIGN KEY ("admin_structure_id") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
