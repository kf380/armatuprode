-- Changelog (es): release publico controlado.
--   Mundial 2026: agrega slug/year/hostCountries en Tournament, modelo Team,
--   officialMatchNumber + venue/city/country/source en Match, fases ROUND_OF_32
--   y THIRD_PLACE, indices/unique para queries de fixture.
--   Operativa: modelo AdminAuditLog para acciones de admin.

-- 1) Tournament: slug, year, hostCountries
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "year" INTEGER;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "hostCountries" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE UNIQUE INDEX IF NOT EXISTS "Tournament_slug_key" ON "Tournament"("slug");

-- 2) TournamentPhase: nuevos valores
ALTER TYPE "TournamentPhase" ADD VALUE IF NOT EXISTS 'ROUND_OF_32';
ALTER TYPE "TournamentPhase" ADD VALUE IF NOT EXISTS 'THIRD_PLACE';

-- 3) Match: official number + ubicacion + source
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "officialMatchNumber" INTEGER;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "venue" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- Unique para upsert idempotente del seed (oficialMatchNumber por torneo).
CREATE UNIQUE INDEX IF NOT EXISTS "Match_tournamentId_officialMatchNumber_key"
  ON "Match"("tournamentId", "officialMatchNumber");

-- Indices de query frecuentes
CREATE INDEX IF NOT EXISTS "Match_tournamentId_phase_idx"
  ON "Match"("tournamentId", "phase");
CREATE INDEX IF NOT EXISTS "Match_tournamentId_matchGroup_idx"
  ON "Match"("tournamentId", "matchGroup");
CREATE INDEX IF NOT EXISTS "Match_status_matchDate_idx"
  ON "Match"("status", "matchDate");

-- 4) Team
CREATE TABLE IF NOT EXISTS "Team" (
  "id"            TEXT PRIMARY KEY,
  "tournamentId"  TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "country"       TEXT NOT NULL,
  "flag"          TEXT NOT NULL DEFAULT '',
  "confederation" TEXT,
  "groupCode"     TEXT,
  "groupSlot"     INTEGER,
  "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Team_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Team_tournamentId_code_key"
  ON "Team"("tournamentId", "code");
CREATE INDEX IF NOT EXISTS "Team_tournamentId_groupCode_idx"
  ON "Team"("tournamentId", "groupCode");

-- 5) AdminAuditLog
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id"        TEXT PRIMARY KEY,
  "action"    TEXT NOT NULL,
  "adminHash" TEXT,
  "ip"        TEXT,
  "userAgent" TEXT,
  "payload"   JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx"
  ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx"
  ON "AdminAuditLog"("createdAt");
