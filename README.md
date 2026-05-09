# ArmaTuProde

Prode social mobile-first construido con Next.js 16 (App Router), Supabase, Prisma y MercadoPago.

## Desarrollo local

```bash
npm install
cp .env.example .env.local  # completar valores
npx prisma generate
npx prisma db push          # solo si cambia el schema
npm run dev
```

## Tests

```bash
npm test            # corre vitest una vez
npm run test:watch  # modo watch
```

## Variables de entorno

### Obligatorias en producción

El handler `validateProductionEnv()` se ejecuta en webhooks y crons y rechaza el boot si falta alguna.

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Postgres Supabase pooler (PgBouncer 6543) |
| `DIRECT_URL` | Postgres directo (5432) — solo para `prisma db push`/migrate |
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (público) |
| `MERCADOPAGO_ACCESS_TOKEN` | Token MP del merchant |
| `MP_WEBHOOK_SECRET` | Secret de notificaciones MP — valida `x-signature`. **Sin esto, prod rechaza todos los webhooks.** |
| `ADMIN_API_KEY` | Auth de endpoints admin (`/api/matches/[id]/finish`, `/api/tournaments`, etc.) |
| `CRON_SECRET` | Auth de Vercel Cron Jobs |

### Opcionales

| Variable | Para qué sirve |
|---|---|
| `NEXT_PUBLIC_APP_URL` | URL canónica para `back_urls` de MP. Si falta, cae a `VERCEL_URL`. |
| `UPSTASH_REDIS_REST_URL` | Rate limiting (Upstash) — sin esto, rate limiting es no-op |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting (Upstash) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push |

### Cómo obtener `MP_WEBHOOK_SECRET`

1. Panel de MercadoPago → Tus integraciones → Webhooks.
2. Copiar la *Clave secreta* del endpoint de notificaciones.
3. Configurar como `MP_WEBHOOK_SECRET` en Vercel (preview + production).

### Configuración de Supabase Auth (producción)

- Activar **Email confirmation** en *Authentication → Providers → Email*.
- El welcome bonus de 100 coins solo se acredita a usuarios con `email_confirmed_at` no nulo. Esto bloquea el farming de cuentas falsas en prod.
- En dev (`NODE_ENV !== "production"`) el bonus se acredita igual para no romper el flujo local.

## Migraciones manuales

El proyecto usa `prisma db push`, no `prisma migrate`. SQLs de cambios significativos viven en `prisma/migrations-manual/` con descripción en español. Aplicarlos directamente contra la BD o vía `prisma db push` después de actualizar `schema.prisma`.

## Endpoints admin

`/admin` es una pantalla server-rendered que requiere cookie `admin_session`. La cookie se obtiene posteando `ADMIN_API_KEY` a `POST /api/admin/auth`. Sin esa cookie, la UI no se renderiza.
