-- =============================================================================
-- Phase 2c — PLAYER_PREMIUM (Versión C)
-- =============================================================================
-- Adds:
--   - PaymentType.PLAYER_PREMIUM enum value
--   - PremiumMembership table (player → tournament, opt-in B2C paywall)
--
-- Risk: LOW. All additive — no breaking changes.
-- The new payment type is gated by ENABLE_PLAYER_PREMIUM flag (default OFF).
--
-- Rollback:
--   DROP TABLE IF EXISTS "PremiumMembership";
--   ALTER TYPE "PaymentType" RENAME TO "PaymentType_old";
--   CREATE TYPE "PaymentType" AS ENUM ('COIN_PACK', 'POOL_ENTRY', 'GROUP_ACTIVATION');
--   -- ...rebind columns to new enum, drop old
-- =============================================================================

-- 1) Add PLAYER_PREMIUM to PaymentType enum (idempotent)
DO $$ BEGIN
  ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'PLAYER_PREMIUM';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) PremiumMembership table
CREATE TABLE IF NOT EXISTS "PremiumMembership" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "tournamentId"   TEXT NOT NULL,
  "paidAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil"     TIMESTAMP(3) NOT NULL,
  "amountUsd"      INTEGER NOT NULL,
  "paymentOrderId" TEXT,
  "source"         TEXT NOT NULL DEFAULT 'mp',
  CONSTRAINT "PremiumMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PremiumMembership_userId_tournamentId_key"
  ON "PremiumMembership" ("userId", "tournamentId");

CREATE INDEX IF NOT EXISTS "PremiumMembership_userId_idx"
  ON "PremiumMembership" ("userId");

CREATE INDEX IF NOT EXISTS "PremiumMembership_validUntil_idx"
  ON "PremiumMembership" ("validUntil");

-- 3) FKs
DO $$ BEGIN
  ALTER TABLE "PremiumMembership"
    ADD CONSTRAINT "PremiumMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PremiumMembership"
    ADD CONSTRAINT "PremiumMembership_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Changelog
-- =============================================================================
-- 2026-05-10  Phase 2c base schema
--   - Nuevo PaymentType.PLAYER_PREMIUM
--   - Tabla PremiumMembership (paywall B2C voluntario, no es apuesta)
--   - Default: feature gateado por ENABLE_PLAYER_PREMIUM=false en prod
--   - Sin schema breaking — totalmente aditivo
-- =============================================================================
