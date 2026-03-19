#!/bin/sh
set -e

# Esperar a que Postgres acepte TCP (Dokploy / orquestadores pueden levantar api antes que db)
node /app/apps/api/scripts/wait-for-postgres.cjs

cd /app/packages/database

# Recuperar migración que pudo fallar por "ProjectType already exists" (db push previo)
if ! npx prisma migrate resolve --applied 20250311000000_add_project_type_relic 2>/dev/null; then
  :
fi

# P3009: migración stage_sdd fallida en deploys viejos (enum Status). Idempotente: solo actúa si sigue en estado fallido.
if npx prisma migrate resolve --rolled-back 20250319140000_stage_sdd_deliverables 2>/dev/null; then
  echo "migrate resolve: cleared failed record for 20250319140000_stage_sdd_deliverables"
fi

# Otra migración atascada (opcional): PRISMA_RESOLVE_ROLLED_BACK=<nombre_carpeta>
if [ -n "$PRISMA_RESOLVE_ROLLED_BACK" ]; then
  echo "prisma migrate resolve --rolled-back $PRISMA_RESOLVE_ROLLED_BACK"
  npx prisma migrate resolve --rolled-back "$PRISMA_RESOLVE_ROLLED_BACK" || true
fi

# Migraciones en cada arranque del contenedor (producción); fallo → exit 1, sin API
echo "Running prisma migrate deploy..."
npx prisma migrate deploy || {
  echo "ERROR: prisma migrate deploy failed. Check DATABASE_URL and that migrations exist."
  echo "Si es P3009 con otra migración: packages/database/README.md — PRISMA_RESOLVE_ROLLED_BACK o resolve manual."
  exit 1
}

cd /app/apps/api
MAIN_JS="$(find . -name main.js -type f 2>/dev/null | head -1)"
if [ -z "$MAIN_JS" ]; then
  echo "ERROR: main.js not found in dist. Check Nest build output."
  exit 1
fi
echo "Starting API ($MAIN_JS)..."
exec node "$MAIN_JS"
