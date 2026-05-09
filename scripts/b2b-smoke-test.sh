#!/usr/bin/env bash
# B2B backend smoke tests (etapas 1-5).
#
# Cómo usar:
#   1) Logueate en https://armatuprode.com.ar (signup + confirmar email)
#   2) En DevTools → Application → Local Storage → buscar "supabase.auth" o
#      cookies "sb-*-auth-token". Copiar el access_token (JWT).
#   3) export TOKEN="eyJ..."  (sin "Bearer ")
#   4) export BASE_URL="https://armatuprode.com.ar"  (o preview)
#   5) export TOURNAMENT_ID="..."  (de la DB: SELECT id FROM "Tournament" WHERE slug='world-cup-2026')
#   6) bash scripts/b2b-smoke-test.sh
#
# El script asume jq instalado (brew install jq).

set -euo pipefail

: "${TOKEN:?Falta TOKEN}"
: "${BASE_URL:=https://armatuprode.com.ar}"
: "${TOURNAMENT_ID:?Falta TOURNAMENT_ID}"

H_AUTH="Authorization: Bearer ${TOKEN}"
H_JSON="Content-Type: application/json"

pass() { printf "\033[32m✓ %s\033[0m\n" "$*"; }
fail() { printf "\033[31m✗ %s\033[0m\n" "$*"; exit 1; }
hr()   { printf -- "------------------------------------------------------------\n"; }

# ---------------------------------------------------------------------------
# A. PERSONAL FREE → ACTIVE inmediato
# ---------------------------------------------------------------------------
hr; echo "A. Crear PERSONAL FREE"
A=$(curl -s -X POST "$BASE_URL/api/groups" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d "{
    \"name\":\"Smoke FREE\",
    \"emoji\":\"🆓\",
    \"tournamentId\":\"$TOURNAMENT_ID\",
    \"type\":\"PERSONAL\",
    \"planType\":\"FREE\"
  }")
echo "$A" | jq '.'
GROUP_FREE=$(echo "$A" | jq -r '.group.id // empty')
[[ -z "$GROUP_FREE" ]] && fail "No se creó grupo FREE"
[[ $(echo "$A" | jq -r '.group.status') == "ACTIVE" ]] || fail "FREE no es ACTIVE"
[[ $(echo "$A" | jq -r '.group.planType') == "FREE" ]] || fail "planType incorrecto"
[[ $(echo "$A" | jq -r '.group.participantLimit') == "10" ]] || fail "participantLimit ≠ 10"
[[ $(echo "$A" | jq -r '.group.paymentResponsibility') == "NONE" ]] || fail "paymentResponsibility ≠ NONE"
[[ $(echo "$A" | jq -r '.group.isPremium') == "false" ]] || fail "isPremium ≠ false"
pass "PERSONAL FREE: ACTIVE, planType=FREE, limit=10, NONE responsibility, !premium"

# ---------------------------------------------------------------------------
# B. PERSONAL_PLUS → PENDING_PAYMENT, join bloqueado
# ---------------------------------------------------------------------------
hr; echo "B. Crear PERSONAL_PLUS"
B=$(curl -s -X POST "$BASE_URL/api/groups" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d "{
    \"name\":\"Smoke PLUS\",
    \"emoji\":\"➕\",
    \"tournamentId\":\"$TOURNAMENT_ID\",
    \"type\":\"PERSONAL\",
    \"planType\":\"PERSONAL_PLUS\"
  }")
echo "$B" | jq '.'
GROUP_PLUS=$(echo "$B" | jq -r '.group.id')
[[ $(echo "$B" | jq -r '.group.status') == "PENDING_PAYMENT" ]] || fail "PERSONAL_PLUS no es PENDING_PAYMENT"
[[ $(echo "$B" | jq -r '.group.participantLimit') == "50" ]] || fail "participantLimit ≠ 50"
pass "PERSONAL_PLUS: PENDING_PAYMENT, limit=50"

echo "B.1 join debería estar bloqueado (status≠ACTIVE)"
INVITE=$(echo "$B" | jq -r '.group.inviteCode')
JOIN_RES=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/groups/$GROUP_PLUS/join" \
  -H "$H_AUTH" -H "$H_JSON" -d "{\"inviteCode\":\"$INVITE\"}")
[[ "$JOIN_RES" == "403" || "$JOIN_RES" == "409" ]] || fail "Join no bloqueado (HTTP $JOIN_RES)"
pass "Join bloqueado en PENDING_PAYMENT (HTTP $JOIN_RES)"

echo "B.2 payments/create type=group_activation crea PaymentOrder"
PAY_B=$(curl -s -X POST "$BASE_URL/api/payments/create" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"type\":\"group_activation\",\"groupId\":\"$GROUP_PLUS\",\"planType\":\"PERSONAL_PLUS\",\"estimatedPlayers\":20}")
echo "$PAY_B" | jq '.'
[[ $(echo "$PAY_B" | jq -r '.orderId // empty') ]] || fail "No se creó PaymentOrder"
[[ $(echo "$PAY_B" | jq -r '.initPoint // empty') ]] || fail "No se obtuvo initPoint"
pass "GROUP_ACTIVATION PaymentOrder + initPoint MP"

# ---------------------------------------------------------------------------
# C. ORGANIZATION + COMMUNITY → PENDING_PAYMENT
# ---------------------------------------------------------------------------
hr; echo "C. Crear Organization + grupo COMMUNITY"
ORG=$(curl -s -X POST "$BASE_URL/api/organizations" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"slug\":\"smoke-test-$(date +%s)\",\"name\":\"Smoke Org\"}")
echo "$ORG" | jq '.'
ORG_ID=$(echo "$ORG" | jq -r '.organization.id // empty')
[[ -z "$ORG_ID" ]] && fail "No se creó organization"
pass "Organization creada: $ORG_ID"

C=$(curl -s -X POST "$BASE_URL/api/groups" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d "{
    \"name\":\"Smoke COMMUNITY\",
    \"tournamentId\":\"$TOURNAMENT_ID\",
    \"type\":\"ORGANIZATION\",
    \"planType\":\"COMMUNITY\",
    \"organizationId\":\"$ORG_ID\"
  }")
echo "$C" | jq '.'
GROUP_COMM=$(echo "$C" | jq -r '.group.id')
[[ $(echo "$C" | jq -r '.group.status') == "PENDING_PAYMENT" ]] || fail "COMMUNITY no es PENDING_PAYMENT"
[[ $(echo "$C" | jq -r '.group.participantLimit') == "100" ]] || fail "participantLimit COMMUNITY ≠ 100"
pass "ORGANIZATION COMMUNITY: PENDING_PAYMENT, limit=100"

echo "C.1 ownership: OTRO usuario sin permisos en la org no puede crear ahí"
echo "(skip — requiere segundo TOKEN; se valida server-side)"

# ---------------------------------------------------------------------------
# G. Real money pools BLOQUEADO con flag OFF
# ---------------------------------------------------------------------------
hr; echo "G. Real-money pool bloqueado"
G_RES=$(curl -s -o /tmp/g.json -w "%{http_code}" -X POST "$BASE_URL/api/groups" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d "{
    \"name\":\"Pool fail\",
    \"tournamentId\":\"$TOURNAMENT_ID\",
    \"hasPool\":true,
    \"entryFee\":1000
  }")
[[ "$G_RES" == "403" ]] || fail "hasPool=true debería tirar 403 (got $G_RES)"
echo "Body: $(cat /tmp/g.json | jq -r '.error')"
pass "hasPool=true rechazado con 403"

G2_RES=$(curl -s -o /tmp/g2.json -w "%{http_code}" -X POST "$BASE_URL/api/payments/create" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"type\":\"pool_entry\",\"groupId\":\"$GROUP_FREE\"}")
[[ "$G2_RES" == "403" ]] || fail "pool_entry debería tirar 403 (got $G2_RES)"
pass "pool_entry rechazado con 403 (ENABLE_REAL_MONEY_POOLS=false)"

# ---------------------------------------------------------------------------
# WHITE_LABEL no se puede usar
# ---------------------------------------------------------------------------
hr; echo "WL. WHITE_LABEL bloqueado en endpoints públicos"
WL_RES=$(curl -s -o /tmp/wl.json -w "%{http_code}" -X POST "$BASE_URL/api/groups" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d "{
    \"name\":\"WL fail\",
    \"tournamentId\":\"$TOURNAMENT_ID\",
    \"type\":\"ORGANIZATION\",
    \"planType\":\"WHITE_LABEL\"
  }")
[[ "$WL_RES" == "403" ]] || fail "WHITE_LABEL debería tirar 403 (got $WL_RES)"
pass "WHITE_LABEL rechazado con 403"

WL2_RES=$(curl -s -o /tmp/wl2.json -w "%{http_code}" -X POST "$BASE_URL/api/payments/create" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"type\":\"group_activation\",\"groupId\":\"$GROUP_PLUS\",\"planType\":\"WHITE_LABEL\"}")
[[ "$WL2_RES" == "403" ]] || fail "payments WHITE_LABEL debería tirar 403 (got $WL2_RES)"
pass "payments WHITE_LABEL rechazado con 403"

# ---------------------------------------------------------------------------
# F. Capacity check (smoke level — un solo usuario no puede llenar 10 slots)
# ---------------------------------------------------------------------------
hr; echo "F. Capacity"
echo "(skip end-to-end — requeriría 11 usuarios distintos. El test unitario en "
echo " tests/b2b-evolution.test.ts cubre el invariante en canJoinGroup)"
pass "Capacity invariant cubierto en unit tests"

# ---------------------------------------------------------------------------
# Cleanup opcional (NO se ejecuta — los smoke groups quedan en DB para revisión)
# ---------------------------------------------------------------------------
hr
echo ""
echo "Smoke groups creados (revisá en DB y borrá si querés):"
echo "  PERSONAL FREE:    $GROUP_FREE"
echo "  PERSONAL_PLUS:    $GROUP_PLUS  (status=PENDING_PAYMENT)"
echo "  ORGANIZATION CMT: $GROUP_COMM  (status=PENDING_PAYMENT)"
echo "  Organization:     $ORG_ID"
echo ""
echo "Para validar D (webhook approved) y E (refund) — se requiere pago real"
echo "test card en MP. Ver checklist abajo."
