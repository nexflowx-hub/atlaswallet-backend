-- CreateEnum
CREATE TYPE "IdentityLevel" AS ENUM ('SELF_DECLARED', 'BASIC', 'VERIFIED', 'ENHANCED');

-- CreateEnum
CREATE TYPE "OperationalMode" AS ENUM ('OPEN', 'CONTROLLED', 'RESTRICTED');

-- CreateTable
CREATE TABLE "pricing_plans" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "fee_basis_points" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pricing_plans_fee_basis_points_check" CHECK ("fee_basis_points" >= 0 AND "fee_basis_points" <= 10000)
);

-- CreateTable
CREATE TABLE "policy_profiles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "operational_mode" "OperationalMode" NOT NULL DEFAULT 'CONTROLLED',
    "allow_fiat_deposit" BOOLEAN NOT NULL DEFAULT false,
    "allow_fiat_withdrawal" BOOLEAN NOT NULL DEFAULT false,
    "allow_crypto_deposit" BOOLEAN NOT NULL DEFAULT false,
    "allow_crypto_withdrawal" BOOLEAN NOT NULL DEFAULT false,
    "allow_exchange" BOOLEAN NOT NULL DEFAULT false,
    "allow_internal_transfer" BOOLEAN NOT NULL DEFAULT false,
    "allow_investment" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_profiles_pkey" PRIMARY KEY ("id")
);

-- Seed canonical commercial pricing tiers
INSERT INTO "pricing_plans" (
    "id", "code", "label", "fee_basis_points", "active", "sort_order", "metadata", "updated_at"
) VALUES
    ('10000000-0000-4000-8000-000000000030', 'BLACK_30', 'Atlas Black 30', 3000, true, 10, '{"tier":"BLACK","verification":"SELF_DECLARED"}'::jsonb, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000025', 'BLACK_25', 'Atlas Black 25', 2500, true, 20, '{"tier":"BLACK"}'::jsonb, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000020', 'BLACK_20', 'Atlas Black 20', 2000, true, 30, '{"tier":"BLACK"}'::jsonb, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000015', 'WHITE_15', 'Atlas White 15', 1500, true, 40, '{"tier":"WHITE"}'::jsonb, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000010', 'WHITE_10', 'Atlas White 10', 1000, true, 50, '{"tier":"WHITE"}'::jsonb, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000005', 'WHITE_05', 'Atlas White 05', 500, true, 60, '{"tier":"WHITE"}'::jsonb, CURRENT_TIMESTAMP);

-- Seed frictionless entry policy. These flags express the account policy intent.
-- Effective money movement remains additionally gated by system/provider/asset/risk controls.
INSERT INTO "policy_profiles" (
    "id", "code", "label", "operational_mode",
    "allow_fiat_deposit", "allow_fiat_withdrawal",
    "allow_crypto_deposit", "allow_crypto_withdrawal",
    "allow_exchange", "allow_internal_transfer", "allow_investment",
    "active", "metadata", "updated_at"
) VALUES (
    '20000000-0000-4000-8000-000000000001',
    'BLACK_ENTRY_OPEN',
    'Black Entry Open',
    'OPEN',
    true, true,
    true, true,
    true, true, false,
    true,
    '{"purpose":"frictionless_entry","documents_required_at_entry":false,"proof_required_at_entry":false}'::jsonb,
    CURRENT_TIMESTAMP
);

-- AlterTable
ALTER TABLE "accounts"
    ADD COLUMN "identity_level" "IdentityLevel" NOT NULL DEFAULT 'SELF_DECLARED',
    ADD COLUMN "pricing_plan_id" UUID,
    ADD COLUMN "policy_profile_id" UUID;

-- Backfill any already-provisioned accounts to the frictionless entry profile.
UPDATE "accounts"
SET
    "pricing_plan_id" = '10000000-0000-4000-8000-000000000030',
    "policy_profile_id" = '20000000-0000-4000-8000-000000000001'
WHERE "pricing_plan_id" IS NULL OR "policy_profile_id" IS NULL;

ALTER TABLE "accounts"
    ALTER COLUMN "pricing_plan_id" SET NOT NULL,
    ALTER COLUMN "policy_profile_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "pricing_plans_code_key" ON "pricing_plans"("code");
CREATE INDEX "pricing_plans_active_sort_order_idx" ON "pricing_plans"("active", "sort_order");
CREATE UNIQUE INDEX "policy_profiles_code_key" ON "policy_profiles"("code");
CREATE INDEX "policy_profiles_active_operational_mode_idx" ON "policy_profiles"("active", "operational_mode");
CREATE INDEX "accounts_identity_level_idx" ON "accounts"("identity_level");
CREATE INDEX "accounts_pricing_plan_id_idx" ON "accounts"("pricing_plan_id");
CREATE INDEX "accounts_policy_profile_id_idx" ON "accounts"("policy_profile_id");

-- AddForeignKey
ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_pricing_plan_id_fkey"
    FOREIGN KEY ("pricing_plan_id") REFERENCES "pricing_plans"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_policy_profile_id_fkey"
    FOREIGN KEY ("policy_profile_id") REFERENCES "policy_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
