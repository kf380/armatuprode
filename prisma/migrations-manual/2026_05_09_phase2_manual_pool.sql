-- =============================================================================
-- Phase 2 — MANUAL_POOL (Versión B)
-- =============================================================================
-- Adds:
--   - MoneyMode enum
--   - Group.moneyMode (default NONE)
--   - Group.declaredPoolEntry / declaredPoolCurrency / declaredPoolUpdatedAt
--   - PoolPaymentTracking table (organizer-marked, no money custody)
--
-- Risk: LOW. All additive — no breaking changes to existing rows.
-- Default MoneyMode=NONE preserves current behavior for every existing Group.
--
-- Rollback (in reverse order):
--   DROP TABLE IF EXISTS "PoolPaymentTracking";
--   ALTER TABLE "Group" DROP COLUMN IF EXISTS "moneyMode",
--                       DROP COLUMN IF EXISTS "declaredPoolEntry",
--                       DROP COLUMN IF EXISTS "declaredPoolCurrency",
--                       DROP COLUMN IF EXISTS "declaredPoolUpdatedAt";
--   DROP TYPE IF EXISTS "MoneyMode";
-- =============================================================================

-- 1) MoneyMode enum (idempotent)
DO $$ BEGIN
  CREATE TYPE "MoneyMode" AS ENUM ('NONE', 'MANUAL_POOL', 'AUTOMATED_POOL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Group columns (idempotent via IF NOT EXISTS)
ALTER TABLE "Group"
  ADD COLUMN IF NOT EXISTS "moneyMode"             "MoneyMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "declaredPoolEntry"     INTEGER,
  ADD COLUMN IF NOT EXISTS "declaredPoolCurrency"  TEXT DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS "declaredPoolUpdatedAt" TIMESTAMP(3);

-- 3) PoolPaymentTracking table
CREATE TABLE IF NOT EXISTS "PoolPaymentTracking" (
  "id"          TEXT NOT NULL,
  "groupId"     TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "paid"        BOOLEAN NOT NULL DEFAULT FALSE,
  "paidAt"      TIMESTAMP(3),
  "markedById"  TEXT NOT NULL,
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoolPaymentTracking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PoolPaymentTracking_groupId_userId_key"
  ON "PoolPaymentTracking" ("groupId", "userId");

CREATE INDEX IF NOT EXISTS "PoolPaymentTracking_groupId_idx"
  ON "PoolPaymentTracking" ("groupId");

-- 4) FK to Group (deferred for rollback safety)
DO $$ BEGIN
  ALTER TABLE "PoolPaymentTracking"
    ADD CONSTRAINT "PoolPaymentTracking_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Changelog
-- =============================================================================
-- 2026-05-09  Phase 2 base schema
--   - MoneyMode enum (NONE | MANUAL_POOL | AUTOMATED_POOL)
--   - Group: 4 fields nuevos (moneyMode + declared pool metadata)
--   - PoolPaymentTracking: tracking interno del organizer
--   - Default MoneyMode=NONE — comportamiento actual preservado.
--   - AUTOMATED_POOL en enum solo por completeness; sigue HARD-OFF por flag.
--   - Sin escritura nueva a PoolContribution (cápsula legacy intacta).
-- =============================================================================
