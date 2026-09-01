-- Self-declared profile for progressive/frictionless onboarding.
-- This data is user-declared and is NOT proof of identity or KYC verification.

CREATE TABLE "self_declared_profiles" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "first_name" VARCHAR(80),
    "last_name" VARCHAR(80),
    "date_of_birth" DATE,
    "nationality_country_code" VARCHAR(2),
    "residence_country_code" VARCHAR(2),
    "phone_e164" VARCHAR(32),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "self_declared_profiles_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "self_declared_profiles_nationality_country_code_check"
        CHECK (
          "nationality_country_code" IS NULL
          OR "nationality_country_code" ~ '^[A-Z]{2}$'
        ),

    CONSTRAINT "self_declared_profiles_residence_country_code_check"
        CHECK (
          "residence_country_code" IS NULL
          OR "residence_country_code" ~ '^[A-Z]{2}$'
        ),

    CONSTRAINT "self_declared_profiles_phone_e164_check"
        CHECK (
          "phone_e164" IS NULL
          OR "phone_e164" ~ '^\+[1-9][0-9]{7,14}$'
        )
);

CREATE UNIQUE INDEX
    "self_declared_profiles_account_id_key"
ON "self_declared_profiles"("account_id");

CREATE INDEX
    "self_declared_profiles_residence_country_code_idx"
ON "self_declared_profiles"("residence_country_code");

ALTER TABLE "self_declared_profiles"
ADD CONSTRAINT "self_declared_profiles_account_id_fkey"
FOREIGN KEY ("account_id")
REFERENCES "accounts"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
