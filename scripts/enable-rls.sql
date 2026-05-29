-- ============================================================
-- Enable RLS en todas las tablas de armatuprode
-- Generado 2026-05-29 (v2: usa DO block para evitar problemas de quoting)
--
-- Estrategia: enable RLS SIN policies → cero acceso desde anon/authenticated keys.
-- Prisma usa postgres superuser via pooler → bypassa RLS automáticamente.
--
-- Cómo correr:
--   Supabase SQL Editor → pegar todo este archivo → Run.
--
-- Verificación post-apply:
--   npx tsx scripts/verify-rls.ts
--
-- Rollback: reemplazar "ENABLE ROW LEVEL SECURITY" por "DISABLE ROW LEVEL SECURITY"
-- en el EXECUTE format() del bloque.
-- ============================================================

DO $$
DECLARE
  r RECORD;
  count_changed INT := 0;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '\_%'
      AND rowsecurity = false
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    RAISE NOTICE 'RLS enabled: %', r.tablename;
    count_changed := count_changed + 1;
  END LOOP;

  RAISE NOTICE '==> Total tablas con RLS recién habilitado: %', count_changed;
END $$;

-- ============================================================
-- Verificación visual: debería listar todas con rowsecurity = true
-- ============================================================
SELECT
  tablename,
  rowsecurity AS "RLS enabled"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE '\_%'
ORDER BY rowsecurity DESC, tablename;
