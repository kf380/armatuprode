# ArmaTuProde — Modelo de dinero (MoneyMode)

Este documento define **cómo se mueve la plata en ArmaTuProde** y por qué hoy
la plataforma **NO** procesa pozos cash de jugadores.

Es la fuente de verdad sobre qué soporta la app, qué no, y qué requiere
decisión legal/producto antes de abrir.

---

## 1. Tres modos discretos

```
MoneyMode
├── NONE              ← modo activo hoy
├── MANUAL_POOL       ← futuro, sin custodia
└── AUTOMATED_POOL    ← futuro, requiere compliance
```

### NONE (activo hoy)

- El **organizador** paga el plan del prode (FREE / PERSONAL_PLUS / COMMUNITY /
  BUSINESS) por adelantado.
- Los **jugadores invitados juegan gratis**.
- El **premio es manual**: lo define y lo entrega el organizador (`prizeType =
  MANUAL_FIXED` con `prizeDescription` libre, o `prizeType = SPONSOR`).
- ArmaTuProde **NO cobra a jugadores**.
- ArmaTuProde **NO custodia dinero**.
- ArmaTuProde **NO reparte premios**.
- Único movimiento de dinero: organizador → ArmaTuProde (vía MercadoPago).

### MANUAL_POOL (futuro, no implementado)

- La app muestra al organizador y a los jugadores:
  - **Entrada sugerida** (texto definido por el organizador)
  - **Pozo estimado** (entrada × jugadores activos)
  - **Reglas del premio** (texto libre)
- El organizador puede **marcar quién pagó** dentro de la app (registro
  manual), para tener tablero compartido.
- ArmaTuProde **NO procesa pagos** de jugadores.
- ArmaTuProde **NO custodia dinero**.
- ArmaTuProde **NO reparte premios**.
- El organizador gestiona toda la plata por fuera (transferencia, efectivo,
  link MP suelto, lo que prefiera).
- Beneficio: agrega valor a grupos que ya cobran entrada cash sin abrir
  superficie regulatoria.

### AUTOMATED_POOL (futuro, bloqueado por flags)

- Los jugadores pagan dentro de la app (MP).
- La app registra contribuciones, calcula pozo neto, opcionalmente cobra fee.
- La app **podría** repartir premios automáticamente a ganadores.
- Requiere **TODO** lo siguiente antes de habilitarse:
  - Revisión legal (potencial encuadre como juego de azar / apuestas en AR)
  - KYC de organizadores y jugadores
  - Verificación de mayoría de edad (≥18)
  - Bloqueo por jurisdicción (al menos AR hasta licencia)
  - Términos y condiciones específicos para pozos cash
  - Reserva por chargebacks
  - SLA de soporte para disputas
  - Auditoría de resultados deportivos desde fuente oficial

---

## 2. Estado actual del código (legacy capsule)

Existen **artefactos legacy** de un intento previo de `AUTOMATED_POOL` que
**siguen vivos pero apagados** por feature flags. NO se borran porque:

1. Pasaron por una validación end-to-end con plata real (pago + reembolso).
2. Borrar enums Prisma genera migrations rotas.
3. Cuando volvamos a abrir AUTOMATED_POOL, esto es la base.

Artefactos vivos (gateados):

| Artefacto | Tipo | Estado |
|---|---|---|
| `PoolContribution` | modelo Prisma | tabla creada, sin escrituras nuevas |
| `PaymentType.POOL_ENTRY` | enum Prisma | en uso solo en payments/create gated |
| `Group.hasPool` | columna | `false` por default; wizard nunca lo setea |
| `Group.entryFee` | columna | `0` por default |
| `Group.poolDistribution` | columna `Int[]` | `[50,30,20]` default sin uso |
| `Group.currency` | columna | `"ARS"` |
| `POST /api/payments/create` rama `pool_entry` | endpoint | gated por `canPlayersBeCharged()` |
| Webhook MP rama `POOL_ENTRY` (approved + refund) | endpoint | activo, probado |
| `GET /api/groups/[id]/pool` | endpoint | devuelve `hasPool/entryFee/contribuciones` |
| `POST /api/groups/[id]/pool` | endpoint | **410 Gone** (deprecated) |

**Reglas de oro sobre la cápsula legacy:**

- ❌ NO activar `enablePlayerPayments` sin sign-off legal explícito.
- ❌ NO escribir UI nueva que muestre `hasPool/entryFee` salvo en MoneyMode != NONE.
- ❌ NO eliminar `PaymentType.POOL_ENTRY` del enum (rompe migrations).
- ❌ NO eliminar `PoolContribution` table todavía.
- ✅ SÍ ignorar `hasPool/entryFee/poolDistribution/currency` en cualquier UI
   nueva (`/organizer`, `/organizer/[id]`, billing, etc.).

---

## 3. Por qué NO se activa hoy

| Causa | Detalle |
|---|---|
| **Riesgo regulatorio AR** | Procesar pozos cash + repartir premios en función de evento aleatorio puede encuadrarse como apuesta deportiva. Lotería de la Provincia (BA) y LOTBA (CABA) tienen jurisdicción exclusiva. |
| **Custodia de fondos** | Cobrar a 20 jugadores y guardar la plata hasta el cierre nos hace agentes de custodia financiera (fideicomiso/escrow/licencia). |
| **Sin KYC ni verificación de edad** | No cumplimos requisitos básicos de juegos de azar (mayoría de edad, residencia). |
| **Sin sign-off legal** | `legalRealMoneyPoolsApproved = false`. |
| **Sin demanda validada** | El producto no probó todavía con organizadores activos si quieren modo cash. Activarlo es construir-by-spec. |
| **UX no resuelta** | Pozo único por grupo no soporta rondas/zonas/progresivos (3 de los 6 casos de negocio analizados). |

---

## 4. Flags

### Vigentes (en `src/lib/flags.ts`)

| Flag | Default prod | Significado |
|---|---|---|
| `enableB2bOrganizers` | `true` | habilita stack B2B (Organization, planes COMMUNITY/BUSINESS) |
| `enablePersonalGroups` | `true` | grupos PERSONAL siguen funcionando |
| `enableOrganizationPlans` | `true` | habilita planes para organizaciones |
| `enableManualPrizes` | `true` | premios manuales del organizador |
| `enableCoinShop` | `false` | tienda de coins desactivada en prod |
| `enableRealMoneyPools` | `true` | (legacy) gate base para cápsula cash |
| `enablePlayerPayments` | `false` | gate específico para cobrar a jugadores |
| `legalRealMoneyPoolsApproved` | `false` | sign-off legal compliance |
| `enablePremiumTournaments` | `false` | placeholder, sin uso |

### `canPlayersBeCharged()` (triple gate)

```
canPlayersBeCharged =
  enableRealMoneyPools
  && enablePlayerPayments
  && legalRealMoneyPoolsApproved
```

Hoy = `false` en prod (al menos los dos últimos lo bloquean). Es la única
puerta que decide si la plataforma puede cobrar a jugadores.

### Flags futuras propuestas (NO crear hasta abrir Fase 2)

| Flag | Para |
|---|---|
| `enableManualPools` | habilita modo MANUAL_POOL (tablero informativo) |
| `enableSemiAutomatedPools` | jugador paga al organizer fuera de plataforma, app trackea |
| `enableAutomatedPools` | reemplazo explícito de `enablePlayerPayments` |
| `enablePlatformFees` | cobro de comisión sobre pozos automáticos |
| `enablePrizeDistribution` | reparto automático de premios |
| `enableMultiPoolPerGroup` | pools por ronda/zona |
| `enableJurisdictionGate` | bloqueo por país/provincia |

---

## 5. Roadmap por fases

| Fase | Modo | Esfuerzo | Riesgo legal | Cuándo |
|---|---|---|---|---|
| **1** (actual) | NONE | bajo (terminar `/organizer/[id]`) | nulo | now |
| **2** | NONE + MANUAL_POOL | medio (UI de tablero informativo) | bajo | post-PMF Fase 1 |
| **3** | NONE + MANUAL_POOL + SEMI_AUTO | medio-alto (rerouting MP a organizer) | medio | solo si Fase 2 valida demanda |
| **4** | + AUTOMATED_POOL | alto (compliance + KYC + jurisdicción) | **alto** | solo con sign-off legal |

---

## 6. Qué NO tocar sin decisión explícita

- ❌ `enablePlayerPayments` → flippear a `true`
- ❌ `legalRealMoneyPoolsApproved` → flippear a `true`
- ❌ Borrar `PaymentType.POOL_ENTRY` del enum
- ❌ Borrar tabla `PoolContribution`
- ❌ Borrar `Group.hasPool / entryFee / poolDistribution / currency`
- ❌ Activar UI de "POZO ACUMULADO" en pantallas nuevas
- ❌ Crear endpoints nuevos `/pool/contribute` o `/pool/distribute`
- ❌ Migrar `Group.hasPool` → `MoneyMode` enum (Fase 2)
- ❌ Crear modelo `Pool` separado de `Group` (Fase 4)
- ❌ Crear `PrizeDistribution` (Fase 4)

## 7. Qué SÍ se puede tocar sin riesgo

- ✅ Documentar/limpiar copy de `terms` y `privacy` que mencione "pozos
   cash" como feature activa cuando no lo está.
- ✅ Eliminar UI dead-code de "POZO ACUMULADO" si quedan rastros visibles.
- ✅ Renombrar `enableRealMoneyPools` → `enableLegacyCashPool` en futura
   refactor (no urgente).
- ✅ Agregar tests invariantes que prueben que la cápsula sigue apagada
   (wizard no setea `hasPool`, PATCH rechaza `hasPool`, etc).
- ✅ Construir `/organizer/[id]` (Fase 1).

---

## 8. Glosario

- **Premio manual**: dinero/objeto entregado por el organizador a los
  ganadores. ArmaTuProde no interviene.
- **Pozo informativo**: monto teórico que la app muestra (entrada × jugadores)
  sin tener custodia de la plata.
- **Pozo automático**: pozo donde la plata vive en MP a nombre de la
  plataforma hasta el reparto. Hoy NO existe.
- **Triple gate**: combinación de `enableRealMoneyPools` + `enablePlayerPayments`
  + `legalRealMoneyPoolsApproved` que custodia la activación de pagos por
  jugador. Si una sola es `false`, la cápsula está cerrada.

---

_Última actualización: 2026-05-09. Mantener al día con cualquier decisión
sobre flags o modos de dinero._
