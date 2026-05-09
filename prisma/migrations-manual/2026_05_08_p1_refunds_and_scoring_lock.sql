-- Changelog (es): bloque P1 - habilitar refunds/chargebacks de MercadoPago,
-- agregar scoring lock en Match para evitar doble puntuacion concurrente,
-- y trazabilidad de devoluciones en PoolContribution.

-- 1) Extender enum PaymentStatus con CHARGEBACK
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CHARGEBACK';

-- 2) Match.scoringLockedAt para test-and-set de scoring
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "scoringLockedAt" TIMESTAMP(3);

-- 3) PoolContribution.refundedAt para auditar devoluciones
ALTER TABLE "PoolContribution" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

-- Nota: aplicar tambien `npx prisma generate` despues de correr este SQL
-- para regenerar el cliente con los nuevos campos.
