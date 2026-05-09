# ArmaTuProde — Go-Live Checklist (release público controlado)

Lanzamiento target: beta pública controlada con dinero real, **MAX_PUBLIC_USERS = 5000**, MercadoPago habilitado, Mundial 2026 precargado.

> Cada paso requiere que el operador (humano) marque OK antes de avanzar al siguiente.

## 1. Variables de entorno (Vercel)

### Obligatorias (sin esto, prod no bootea)
- [ ] `DATABASE_URL` (Supabase pooler 6543)
- [ ] `DIRECT_URL` (Supabase directo 5432)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `MERCADOPAGO_ACCESS_TOKEN` (token de prod, no test)
- [ ] `MP_WEBHOOK_SECRET` (panel MP → Webhooks → Clave secreta)
- [ ] `ADMIN_API_KEY` (32+ chars, generar `openssl rand -hex 32`)
- [ ] `CRON_SECRET` (32+ chars, generar `openssl rand -hex 32`)

### Recomendadas (sin esto, rate limiting es no-op — log warning)
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`

### Feature flags release público controlado
- [ ] `ENABLE_REAL_MONEY_POOLS=true` (después de probar pago real)
- [ ] `ENABLE_COIN_SHOP=false` (mantener apagado hasta validar inventario)
- [ ] `ENABLE_PREMIUM_TOURNAMENTS=false`
- [ ] `ENABLE_MANUAL_PRIZES=true`
- [ ] `PUBLIC_LAUNCH_MODE=controlled`

### Límites operativos
- [ ] `MAX_PUBLIC_USERS=5000` (ajustar según contrato MP)
- [ ] `MAX_POOL_PARTICIPANTS=50`
- [ ] `MAX_ENTRY_FEE=20000` (ARS)
- [ ] `MAX_ACTIVE_PAID_GROUPS=50`

### App
- [ ] `NEXT_PUBLIC_APP_URL=https://armatuprode.com.ar`

## 2. Supabase (Auth)

- [ ] Authentication → Providers → Email → **Confirm email = ON**
- [ ] Site URL = `https://armatuprode.com.ar`
- [ ] Redirect URLs incluyen `https://armatuprode.com.ar/api/auth/callback`
- [ ] Probar signup con email real → llega correo de confirmación
- [ ] Probar que welcome bonus NO se acredita pre-confirmación (ver log `welcome_bonus_deferred_email_unverified`)
- [ ] Probar que SÍ se acredita después de confirmar (ver log `welcome_bonus_claim_failed` ausente, balance = 100)

## 3. MercadoPago

- [ ] App MP modo producción activo
- [ ] Webhook URL configurada: `https://armatuprode.com.ar/api/webhooks/mercadopago`
- [ ] Eventos suscritos: `payment` (al menos)
- [ ] Copiar **Clave secreta** del webhook → setear como `MP_WEBHOOK_SECRET` en Vercel
- [ ] Probar webhook simulado desde panel MP → verificar log `webhook_received`
- [ ] Probar pago real con tarjeta de prueba (cuenta de test usuario+vendedor)
  - [ ] Pool de 100 ARS
  - [ ] Verificar log `webhook_processed kind=approved_pool`
  - [ ] Verificar `PoolContribution.paid=true` y `paidAt` poblado
- [ ] Probar refund desde panel MP del pago anterior
  - [ ] Verificar log `refund_processed`
  - [ ] Verificar `PaymentOrder.status=REFUNDED`
  - [ ] Verificar `PoolContribution.paid=false` y `refundedAt` poblado

## 4. Upstash Redis

- [ ] Crear DB en Upstash console (free tier o paid)
- [ ] Copiar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` a Vercel
- [ ] Probar rate limit: hacer 35 predicciones rápidas → la 31+ devuelve 429
- [ ] Verificar ausencia de log `ratelimit_disabled_in_production`

## 5. Migración SQL + Seed Mundial 2026

```bash
# Aplicar migrations P1 + release público
psql "$DIRECT_URL" -f prisma/migrations-manual/2026_05_08_p1_refunds_and_scoring_lock.sql
psql "$DIRECT_URL" -f prisma/migrations-manual/2026_05_08_release_public_controlled.sql

# Generar cliente Prisma
npx prisma generate

# Verificar schema sincronizado (no debería tirar drift)
npx prisma db push --accept-data-loss
```

- [ ] `Tournament` tiene columnas `slug`, `year`, `hostCountries`
- [ ] `Match` tiene `officialMatchNumber`, `venue`, `city`, `country`, `source`, `scoringLockedAt`
- [ ] `PoolContribution` tiene `refundedAt`
- [ ] `PaymentStatus` enum incluye `REFUNDED`, `CHARGEBACK`
- [ ] `TournamentPhase` enum incluye `ROUND_OF_32`, `THIRD_PLACE`
- [ ] Tablas `Team` y `AdminAuditLog` existen
- [ ] Índices `Match_tournamentId_officialMatchNumber_key` y `Match_status_matchDate_idx` existen

### Seed Mundial 2026

```bash
npx tsx prisma/seed.ts
```

Output esperado:
```
[seed] Mundial 2026 → upserting tournament world-cup-2026
[seed] done {
  tournamentSlug: 'world-cup-2026',
  teams: { created: 48, updated: 0, total: 48 },
  matches: { created: 104, updated: 0, preserved: 0, total: 104 }
}
```

- [ ] Re-correr seed dos veces → segunda corrida muestra `created: 0, updated: 104, preserved: 0`
- [ ] Marcar manualmente un match como `FINISHED` con score → re-correr seed → ese match aparece como `preserved: 1`

### // VERIFY antes de promocionar al público
- [ ] Equipos de cada grupo (45 placeholders TBD-X) actualizados con qualifier real, vía edición de `src/data/worldcup-2026.ts` y re-seed
- [ ] Fechas exactas por partido cross-checkadas con PDF FIFA oficial
- [ ] Sedes exactas por partido cross-checkadas

## 6. Tests automatizados

```bash
npm test
```

- [ ] 67+ tests pasan
- [ ] Suites: scoring, mp-signature, env, admin-auth, worldcup-2026-data, flags-and-limits, format-date

## 7. Smoke test en staging (preview deploy)

- [ ] Signup con email real → recibís correo confirmación
- [ ] Confirmar email → app login OK
- [ ] Wallet shows 100 coins (welcome bonus)
- [ ] Crear grupo "free" → OK
- [ ] Crear grupo con pool 5000 ARS → OK
- [ ] Pagar entrada con tarjeta MP test → redirección a `?payment=success`
- [ ] Refresh app → `PoolContribution.paid=true`
- [ ] Refund desde MP → `paid=false`, mensaje al usuario en próximo refresh
- [ ] Hacer predicción de Match #1 (opening) → +10 XP, +10 coins
- [ ] `/admin` sin cookie → muestra login form, no panel
- [ ] Login admin → panel renders, "Cerrar sesión" funciona
- [ ] Admin: marcar Match #1 como LIVE → log `admin_action action=update_live`
- [ ] Admin: finalizar Match #1 score 2-1 → log `match_scoring_finished`, predicciones puntuadas
- [ ] Admin: 2 finishes concurrentes (curl -X POST × 2) → uno 200, otro 409 con log `match_scoring_lock_conflict`

## 8. Promoción a producción

```bash
# Deploy a producción desde Vercel dashboard o CLI:
vercel --prod
```

- [ ] DNS apunta a Vercel (armatuprode.com.ar)
- [ ] HTTPS activo (SSL automático Vercel)
- [ ] Cron jobs activos en Vercel:
  - [ ] `/api/cron/expire-coins` 03:00 UTC diario
  - [ ] `/api/matches/check-reminders` 10:00 UTC diario
- [ ] Verificar logs en Vercel después de un cron tick → log `check_reminders_done` con `durationMs`

## 9. Plan de rollback

Si algo se rompe en prod:

1. **Pagos rotos**: setear `ENABLE_REAL_MONEY_POOLS=false` en Vercel env (no requiere redeploy si usás runtime config) → users no pueden iniciar pagos nuevos
2. **Webhook procesando mal**: redeploy de la versión anterior en Vercel (instantáneo desde dashboard)
3. **DB corrupta**: restore desde Supabase point-in-time recovery (PITR enabled?)
4. **Bug en scoring**: liberar lock manual con SQL: `UPDATE "Match" SET "scoringLockedAt" = NULL, status = 'LIVE' WHERE id = '<id>'` — el partido vuelve a poder finalizar
5. **Abuse / spam**: bajar `MAX_PUBLIC_USERS` a la cantidad actual, setear `PUBLIC_LAUNCH_MODE=closed`

## 10. Monitoreo durante primeras 24hs

Eventos críticos para watchear (Vercel logs filter por `event`):

| Evento | Acción si > 0 |
|---|---|
| `webhook_failed` | Investigar inmediato; revisar `PaymentOrder.status=PENDING` >30min |
| `webhook_signature_invalid` | Posible spoofing o rotación de secret pendiente |
| `match_scoring_lock_conflict` | OK si raro; alerta si recurrente (admin clickeando rápido) |
| `welcome_bonus_failed` | Investigar; impacta UX |
| `ratelimit_redis_error` | Upstash caído — fail-open activo, abuse no protegido |
| `ratelimit_disabled_in_production` | UPSTASH env vars faltantes — fixar inmediato |
| `webhook_refund_debit_failed` | User ya gastó coins refundeados — revisión humana |

Métricas a observar:
- `payment_created` count por hora
- `webhook_processed kind=approved_pool` ratio vs `payment_created`
- `prediction_created` count
- `match_scoring_finished durationMs` p95
- `check_reminders_done durationMs` (si >50000ms acercándose al timeout)

## 11. Criterios de avance a "público abierto" (lift de límites)

- [ ] 7+ días sin incidentes pago/refund
- [ ] No hay logs `webhook_failed` activos
- [ ] No se alcanzó `MAX_PUBLIC_USERS` con problemas
- [ ] Auditoría manual de `AdminAuditLog` confirma acciones intencionales
- [ ] Cobertura de un torneo pequeño completo (varios partidos finalizados, ranking publicado)
- [ ] Lift gradual: subir `MAX_PUBLIC_USERS` a 20000, después 50000

---

## Comandos de referencia rápida

```bash
# Generar secrets
openssl rand -hex 32                         # ADMIN_API_KEY / CRON_SECRET
# Setear env en Vercel
vercel env add MP_WEBHOOK_SECRET production
# Aplicar migrations
psql "$DIRECT_URL" -f prisma/migrations-manual/2026_05_08_p1_refunds_and_scoring_lock.sql
psql "$DIRECT_URL" -f prisma/migrations-manual/2026_05_08_release_public_controlled.sql
# Seed
npx tsx prisma/seed.ts
# Tests
npm test
# Build local
npm run build
# Deploy
vercel --prod
```
