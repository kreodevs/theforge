# Scripts

Scripts de utilidad para el monorepo.

## rotate-master-key

Re-cifra API keys BYOK almacenadas hacia `TOKEN_ACTIVE_KEY_VERSION`.

**Tablas:** `user_provider_configs`, `provider_instances`.

**Requisitos de entorno:**

- `DATABASE_URL` — PostgreSQL (misma BD que el API en prod)
- `TOKEN_MASTER_KEYS` — JSON con **todas** las versiones presentes en BD (p. ej. `{"1":"...","2":"..."}`)
- `TOKEN_ACTIVE_KEY_VERSION` — versión destino (debe existir en el JSON)

**Uso:**

```bash
pnpm run rotate-master-key
```

**Dokploy (sin SSH):** Terminal web del contenedor `theforge-api`:

```bash
cd /app && pnpm run rotate-master-key
```

Documentación completa: [README.md § Cifrado de tokens BYOK](../README.md#cifrado-de-tokens-byok-claves-maestras).

## ensure-infra.js

Asegura runtime Docker (Colima en Mac si hace falta) y contenedores:

| Contenedor | Puerto host |
|------------|-------------|
| `theforge-db` | 5432 |
| `theforge-falkor-sdd` | 6379 |
| `theforge-redis-queue` | 6381 |

Usado por `dev:local` y `dev:api`. Ver [README-LOCAL.md](../README-LOCAL.md).

## wait-for-api.js

Antes de `vite`, hace polling a `GET /health` en el API (por defecto `http://127.0.0.1:3000/health`) hasta que responda o agote el timeout (120s). Lo usa `@theforge/web` en `pnpm run dev` / `dev:local` para que el proxy no reciba `ECONNREFUSED` mientras Nest compila.

Variables opcionales: `PORT` / `API_PORT`, `API_WAIT_HOST`, `API_WAIT_TIMEOUT_MS`, `API_WAIT_INTERVAL_MS`.

Si solo levantas el front (`dev:web`), el API debe estar ya en marcha o el script fallará con timeout.

## ensure-postgres.js

Asegura que Colima (runtime de contenedores) y el contenedor Docker `theforge-db` (Postgres) estén en ejecución. **Preferir `ensure-infra.js`** (Postgres + Falkor + Redis cola).

1. **Colima:** si no está corriendo, ejecuta `colima start --cpu 2 --memory 4`.
2. **Postgres:** si el contenedor no existe, lo crea; si existe pero está parado, lo inicia; si ya está Up, no hace nada.

Se usa desde el script `dev:local` del `package.json` raíz. Requiere Colima y Docker CLI instalados.

## Redis de cola (BullMQ) y `REDIS_URL`

En **Docker Compose** (`docker-compose.yml`) el servicio **`theforge-redis-queue`** expone Redis 6379 **solo en la red interna** del stack; el API recibe `REDIS_URL=redis://theforge-redis-queue:6379` por defecto.

**Producción:** `REDIS_URL` es obligatorio (`NODE_ENV=production`). El entrypoint y `main.ts`/`worker.ts` abortan si falta.

**Procesos separados:** `theforge-api` (`THEFORGE_RUNTIME_ROLE=http`) encola jobs; `theforge-worker` (`THEFORGE_RUNTIME_ROLE=worker`) ejecuta workers BullMQ (MDD, entregables, legacy). Desarrollo local: `THEFORGE_RUNTIME_ROLE=all` en un solo `nest start`.

- **Local sin Compose:** levanta Redis (p. ej. `redis-server` o un contenedor en `localhost:6379`) y en `.env` define `REDIS_URL=redis://localhost:6379`. Si `REDIS_URL` está vacío en dev, la API usa cola in-memory (no usar en prod).
- **No confundir** con **FalkorDB** (`theforge-falkor-sdd`): ese servicio es el grafo SDD (Cypher / MDD_Section), no la cola BullMQ.

## audit-falkor-sdd.mjs

Audita conectividad al grafo SDD local (FalkorDB) y compara nodos de una etapa vs §3/§4 del MDD (tablas SQL y endpoints).

**Requisitos:**

- Falkor SDD en marcha (`theforge-falkor-sdd` vía `ensure-infra.js`, puerto host **6380** en dev local si aplica)
- `FALKORDB_SDD_URL` o `FALKORDB_URL` (default `redis://localhost:6380`)

**Uso:**

```bash
node scripts/audit-falkor-sdd.mjs --project-id <UUID> --stage-id <UUID> --mdd-file /tmp/project.json
```

Opcional: `AUDIT_PROJECT_ID` / `AUDIT_STAGE_ID` en entorno. El `--mdd-file` puede ser JSON de `get_project` (campos `mddContent`, `id`, `activeStageId`) o markdown plano del MDD.

Imprime conteos `DB_Entity` / `API_Endpoint`, huérfanos CONSUMES, diff MDD↔grafo y heurística `sddDomainGraphOk`. Alineado con la lógica de `SddGraphSyncService` / Workshop (`generation-status.sddGraph`).
