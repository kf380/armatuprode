-- Changelog (es): evolucion B2B - grupos personales + prodes empresa/comunidad.
-- Schema-only, sin reparto automatico de dinero.
-- Idempotente: cada CREATE TYPE/TABLE/INDEX puede correrse varias veces sin error.

-- 1) Nuevos enums (idempotentes)
DO $$ BEGIN
  CREATE TYPE "GroupType" AS ENUM ('PERSONAL', 'ORGANIZATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PlanType" AS ENUM ('FREE', 'PERSONAL_PLUS', 'COMMUNITY', 'BUSINESS', 'WHITE_LABEL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GroupStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED', 'PAYMENT_FAILED', 'PAYMENT_REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentResponsibility" AS ENUM ('NONE', 'ORGANIZER', 'COMPANY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PrizeType" AS ENUM ('NONE', 'MANUAL_FIXED', 'SPONSOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OrgMemberRole" AS ENUM ('OWNER', 'ADMIN', 'PLAYER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Nuevo valor en PaymentType existente (idempotente nativo)
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'GROUP_ACTIVATION';

-- 3) Nuevas columnas en Group con defaults seguros.
-- Cada legacy row toma el default al ejecutar ADD COLUMN ... NOT NULL DEFAULT,
-- por lo que NO necesita UPDATE explicito. El perfil resultante es el pedido:
--   type=PERSONAL, planType=FREE, status=ACTIVE,
--   isPremium=false, participantLimit=10 (= PLANS.FREE.maxPlayers),
--   paymentResponsibility=NONE, prizeType=NONE, publicJoinEnabled=false.
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "type"                  "GroupType"             NOT NULL DEFAULT 'PERSONAL';
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "organizationId"        TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "planType"              "PlanType"              NOT NULL DEFAULT 'FREE';
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "status"                "GroupStatus"           NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "isPremium"             BOOLEAN                 NOT NULL DEFAULT false;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "participantLimit"      INTEGER                 NOT NULL DEFAULT 10;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "prizeType"             "PrizeType"             NOT NULL DEFAULT 'NONE';
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "prizeDescription"      TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "rulesDescription"      TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "publicJoinEnabled"     BOOLEAN                 NOT NULL DEFAULT false;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "brandingConfig"        JSONB;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "billingStatus"         TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "paymentResponsibility" "PaymentResponsibility" NOT NULL DEFAULT 'NONE';

-- 4) Indices nuevos en Group
CREATE INDEX IF NOT EXISTS "Group_organizationId_idx" ON "Group"("organizationId");
CREATE INDEX IF NOT EXISTS "Group_status_idx"          ON "Group"("status");
CREATE INDEX IF NOT EXISTS "Group_type_planType_idx"   ON "Group"("type", "planType");

-- 5) Organization
CREATE TABLE IF NOT EXISTS "Organization" (
  "id"            TEXT PRIMARY KEY,
  "slug"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "logoUrl"       TEXT,
  "description"   TEXT,
  "ownerId"       TEXT NOT NULL,
  "plan"          "PlanType" NOT NULL DEFAULT 'FREE',
  "billingStatus" TEXT,
  "maxPlayers"    INTEGER NOT NULL DEFAULT 10,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX        IF NOT EXISTS "Organization_ownerId_idx" ON "Organization"("ownerId");

-- 6) FK Group.organizationId -> Organization.id (idempotente)
DO $$ BEGIN
  ALTER TABLE "Group"
    ADD CONSTRAINT "Group_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7) OrganizationMember
CREATE TABLE IF NOT EXISTS "OrganizationMember" (
  "id"             TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "role"           "OrgMemberRole" NOT NULL DEFAULT 'PLAYER',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationMember_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_organizationId_userId_key"
  ON "OrganizationMember"("organizationId", "userId");
CREATE INDEX        IF NOT EXISTS "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- 8) Sanity: forzar perfil legacy explicito en grupos existentes que pudieran
-- haber quedado en estado raro por una migration parcial previa. Idempotente.
UPDATE "Group" SET
  "type"                  = COALESCE("type", 'PERSONAL'),
  "planType"              = COALESCE("planType", 'FREE'),
  "status"                = COALESCE("status", 'ACTIVE'),
  "participantLimit"      = COALESCE(NULLIF("participantLimit", 0), 10),
  "paymentResponsibility" = COALESCE("paymentResponsibility", 'NONE'),
  "prizeType"             = COALESCE("prizeType", 'NONE'),
  "isPremium"             = COALESCE("isPremium", false),
  "publicJoinEnabled"     = COALESCE("publicJoinEnabled", false);
