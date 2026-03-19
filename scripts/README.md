# Scripts

Scripts de utilidad para el monorepo.

## ensure-postgres.js

Asegura que Colima (runtime de contenedores) y el contenedor Docker `theforge-db` (Postgres) estén en ejecución:

1. **Colima:** si no está corriendo, ejecuta `colima start --cpu 2 --memory 4`.
2. **Postgres:** si el contenedor no existe, lo crea; si existe pero está parado, lo inicia; si ya está Up, no hace nada.

Se usa desde el script `dev:local` del `package.json` raíz. Requiere Colima y Docker CLI instalados.
