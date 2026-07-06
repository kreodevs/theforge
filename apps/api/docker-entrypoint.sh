#!/bin/sh
set -e

# --- Helpers: host/credenciales desde DATABASE_URL (no usar localhost: el DB está en otro contenedor) ---
db_host_from_url() {
  echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p'
}
db_user_from_url() {
  echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):.*|\1|p'
}
db_password_from_url() {
  echo "$DATABASE_URL" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p'
}
db_name_from_url() {
  echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p'
}

project_column_exists() {
  col="$1"
  host="$(db_host_from_url)"
  user="$(db_user_from_url)"
  pass="$(db_password_from_url)"
  db="$(db_name_from_url)"
  [ -n "$host" ] && [ -n "$user" ] && [ -n "$db" ] || return 1
  PGPASSWORD="${pass}" psql -h "$host" -U "$user" -d "$db" -tAc \
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Project' AND column_name='${col}'" \
    2>/dev/null | grep -q 1
}

table_exists() {
  tbl="$1"
  host="$(db_host_from_url)"
  user="$(db_user_from_url)"
  pass="$(db_password_from_url)"
  db="$(db_name_from_url)"
  [ -n "$host" ] && [ -n "$user" ] && [ -n "$db" ] || return 1
  PGPASSWORD="${pass}" psql -h "$host" -U "$user" -d "$db" -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${tbl}'" \
    2>/dev/null | grep -q 1
}

table_column_exists() {
  tbl="$1"
  col="$2"
  host="$(db_host_from_url)"
  user="$(db_user_from_url)"
  pass="$(db_password_from_url)"
  db="$(db_name_from_url)"
  [ -n "$host" ] && [ -n "$user" ] && [ -n "$db" ] || return 1
  PGPASSWORD="${pass}" psql -h "$host" -U "$user" -d "$db" -tAc \
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='${tbl}' AND column_name='${col}'" \
    2>/dev/null | grep -q 1
}

resolve_applied_if_project_column() {
  mig="$1"
  col="$2"
  if project_column_exists "$col"; then
    if npx prisma migrate resolve --applied "$mig" 2>/dev/null; then
      echo "migrate resolve --applied $mig (column Project.${col} already present)"
    fi
  fi
}

resolve_applied_if_table() {
  mig="$1"
  tbl="$2"
  if table_exists "$tbl"; then
    if npx prisma migrate resolve --applied "$mig" 2>/dev/null; then
      echo "migrate resolve --applied $mig (table ${tbl} already present)"
    fi
  fi
}

resolve_applied_if_table_column() {
  mig="$1"
  tbl="$2"
  col="$3"
  if table_column_exists "$tbl" "$col"; then
    if npx prisma migrate resolve --applied "$mig" 2>/dev/null; then
      echo "migrate resolve --applied $mig (column ${tbl}.${col} already present)"
    fi
  fi
}

# Esperar a que Postgres acepte TCP (Dokploy / orquestadores pueden levantar api antes que db)
node /app/apps/api/scripts/wait-for-postgres.cjs

# Dokploy a veces inyecta CORS_ORIGINS="" y anula el default de compose → Nest aborta en producción
if [ -z "${CORS_ORIGINS:-}" ]; then
  export CORS_ORIGINS="https://theforge.kreoint.mx,http://localhost:5173,http://127.0.0.1:5173"
  echo "CORS_ORIGINS unset/empty; using default origins"
fi

if [ -z "${TOKEN_MASTER_KEYS:-}" ]; then
  echo "ERROR: TOKEN_MASTER_KEYS is required. Define JSON {\"1\":\"<base64-32-bytes>\"} in Dokploy (theforge-api)."
  exit 1
fi

if [ -z "${JWT_SECRET:-}" ]; then
  echo "WARN: JWT_SECRET unset; using insecure compose fallback — set a strong secret in Dokploy."
  export JWT_SECRET="local-dev-jwt-secret-replace-in-dokploy"
fi

cd /app/packages/database

# DDL idempotente antes de migrate (db push previo puede haber creado columnas sin registrar migración)
echo "Running safe-schema-sync.sql..."
npx prisma db execute --file /app/packages/database/scripts/safe-schema-sync.sql 2>&1 || true

# NOTA: No marcar migraciones como applied en cada arranque. Eso provocaba que en BD vacías
# se saltara 20250311000000 y fallara 20250311100000 (Project no existe).
# Si db push creó el schema y "ProjectType already exists", ejecutar manualmente una vez:
#   prisma migrate resolve --applied 20250311000000_add_project_type_relic

# P3018: 20250311100000 falló por "Project does not exist" (20250309000000 crea el schema). Desbloquear.
if npx prisma migrate resolve --rolled-back 20250311100000_add_legacy_flow_state 2>/dev/null; then
  echo "migrate resolve: cleared failed record for 20250311100000_add_legacy_flow_state"
fi

# P3009: migración stage_sdd fallida en deploys viejos (enum Status). Idempotente: solo actúa si sigue en estado fallido.
if npx prisma migrate resolve --rolled-back 20250319140000_stage_sdd_deliverables 2>/dev/null; then
  echo "migrate resolve: cleared failed record for 20250319140000_stage_sdd_deliverables"
fi

# P3009: agent_checkpoint_mdd_stage fallida (p. ej. constraint/index ya existente o tabla no creada).
if npx prisma migrate resolve --rolled-back 20260319130000_agent_checkpoint_mdd_stage 2>/dev/null; then
  echo "migrate resolve: cleared failed record for 20260319130000_agent_checkpoint_mdd_stage"
fi

# P3009: columnas ya existentes por db push (agent governance / merge)
if npx prisma migrate resolve --rolled-back 20260609120000_add_agent_governance_content 2>/dev/null; then
  echo "migrate resolve: cleared failed record for 20260609120000_add_agent_governance_content"
fi
if npx prisma migrate resolve --rolled-back 20260612120000_project_merge_suite 2>/dev/null; then
  echo "migrate resolve: cleared failed record for 20260612120000_project_merge_suite"
fi

# P3009: UI MCP — tabla/columnas ya creadas por db push o migración en ruta prisma/migrations previa
if npx prisma migrate resolve --rolled-back 20260702_add_ui_mcp_instance 2>/dev/null; then
  echo "migrate resolve: cleared failed record for 20260702_add_ui_mcp_instance"
fi
if npx prisma migrate resolve --rolled-back 20260703180000_ui_mcp_adapter_id 2>/dev/null; then
  echo "migrate resolve: cleared failed record for 20260703180000_ui_mcp_adapter_id"
fi

# Otra migración atascada (opcional): PRISMA_RESOLVE_ROLLED_BACK=<nombre_carpeta>
if [ -n "$PRISMA_RESOLVE_ROLLED_BACK" ]; then
  echo "prisma migrate resolve --rolled-back $PRISMA_RESOLVE_ROLLED_BACK"
  npx prisma migrate resolve --rolled-back "$PRISMA_RESOLVE_ROLLED_BACK" || true
fi

# Si db push adelantó el DDL, marcar migración como aplicada sin re-ejecutar ADD COLUMN
resolve_applied_if_project_column "20260609120000_add_agent_governance_content" "agentGovernanceContent"
resolve_applied_if_project_column "20260612120000_project_merge_suite" "archivedAt"
resolve_applied_if_table "20260702_add_ui_mcp_instance" "UiMcpInstance"
resolve_applied_if_table_column "20260703180000_ui_mcp_adapter_id" "UiMcpInstance" "adapterId"

# Migraciones en cada arranque del contenedor (producción); fallo → exit 1, sin API
echo "Running prisma migrate deploy..."
npx prisma migrate deploy || {
  echo "ERROR: prisma migrate deploy failed. Check DATABASE_URL and that migrations exist."
  echo "Si es P3009 con otra migración: packages/database/README.md — PRISMA_RESOLVE_ROLLED_BACK o resolve manual."
  exit 1
}

# Opcional (una vez): tras rotar TOKEN_MASTER_KEYS sin la clave vieja. Idempotente; quitar env tras el deploy.
if [ "${WIPE_BYOK_ON_START:-}" = "1" ]; then
  echo "WIPE_BYOK_ON_START=1: wiping ProviderInstance and UserProviderConfig..."
  npx prisma db execute --file /app/apps/api/scripts/wipe-byok-ciphertext.sql
  echo "WIPE_BYOK_ON_START: done. Unset WIPE_BYOK_ON_START in Dokploy before the next redeploy."
fi

# Sincronizar schema: crea columnas/índices no cubiertos por migraciones versionadas
echo "Running prisma db push (schema sync)..."
npx prisma db push --accept-data-loss || true

# Fallback vía Prisma (imagen Alpine no incluye psql)
echo "Checking mcpSecret column via SQL..."
npx prisma db execute --stdin <<'SQL' 2>&1 || true
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mcpSecret" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_mcpSecret_key" ON "User"("mcpSecret");
SQL

cd /app/apps/api
MAIN_JS="$(find . -name main.js -type f 2>/dev/null | head -1)"
if [ -z "$MAIN_JS" ]; then
  echo "ERROR: main.js not found in dist. Check Nest build output."
  exit 1
fi
echo "Starting API ($MAIN_JS)..."
exec node "$MAIN_JS"
