/*
  Warnings:

  - The values [ADMINISTRATEUR_GENERAL] on the enum `user_role` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[identifier]` on the table `auth_verifications` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "user_role_new" AS ENUM ('ADMINISTRATEUR_NATIONAL', 'ADMINISTRATEUR_REGIONAL', 'ADMINISTRATEUR_LOCAL', 'AGENT');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "user_role_new" USING ("role"::text::"user_role_new");
ALTER TYPE "user_role" RENAME TO "user_role_old";
ALTER TYPE "user_role_new" RENAME TO "user_role";
DROP TYPE "public"."user_role_old";
COMMIT;

-- CreateTable
CREATE TABLE "auth_sso_providers" (
    "id" UUID NOT NULL,
    "issuer" VARCHAR(2048) NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "oidc_config" TEXT,
    "saml_config" TEXT,
    "user_id" UUID NOT NULL,
    "provider_id" VARCHAR(100) NOT NULL,
    "organization_id" VARCHAR(255),

    CONSTRAINT "auth_sso_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_sso_providers_provider_id_key" ON "auth_sso_providers"("provider_id");

-- CreateIndex
CREATE INDEX "auth_sso_providers_user_id_idx" ON "auth_sso_providers"("user_id");

-- CreateIndex
CREATE INDEX "auth_sso_providers_domain_idx" ON "auth_sso_providers"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "auth_verifications_saml_reservation_identifier_key" ON "auth_verifications"("identifier") WHERE ("identifier" LIKE 'saml-authn-request:%' OR "identifier" LIKE 'saml-used-assertion:%');

-- AddForeignKey
ALTER TABLE "auth_sso_providers" ADD CONSTRAINT "auth_sso_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
