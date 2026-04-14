# Scripts

Scripts de utilidad para el monorepo.

## ensure-postgres.js

Asegura que Colima (runtime de contenedores) y el contenedor Docker `theforge-db` (Postgres) estén en ejecución:

1. **Colima:** si no está corriendo, ejecuta `colima start --cpu 2 --memory 4`.
2. **Postgres:** si el contenedor no existe, lo crea; si existe pero está parado, lo inicia; si ya está Up, no hace nada.

Se usa desde el script `dev:local` del `package.json` raíz. Requiere Colima y Docker CLI instalados.

## Redis de cola (BullMQ) y `REDIS_URL`

En **Docker Compose** (`docker-compose.yml`) el servicio **`theforge-redis-queue`** expone Redis 6379 **solo en la red interna** del stack; el API recibe `REDIS_URL=redis://theforge-redis-queue:6379` por defecto.

- **Local sin Compose:** levanta Redis (p. ej. `redis-server` o un contenedor en `localhost:6379`) y en `.env` define `REDIS_URL=redis://localhost:6379`. Si `REDIS_URL` está vacío, la API puede operar en modo síncrono para cascadas cortas; cascadas largas de entregables conviene no depender de ello.
- **No confundir** con **FalkorDB** (`theforge-falkor-sdd`): ese servicio es el grafo SDD (Cypher / MDD_Section), no la cola BullMQ.
