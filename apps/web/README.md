# @theforge/web

Frontend React (Vite) + Tailwind de TheForge.

- Lista y creación de proyectos; semáforo (ROJO/AMARILLO/VERDE). El proyecto incluye `complexity` (`LOW` \| `MEDIUM` \| `HIGH`) desde API para adaptar entregables (la UI puede filtrar pestañas según este campo).
- Crear proyecto: **Nuevo**, **Proyecto existente (TheForge)** o **Repositorio existente (TheForge)**. Modal TheForge con pestañas Proyectos / Repositorios (repos derivados de los roots de los proyectos); mismo flujo legacy con `theforgeProjectId` (proyecto o repo).
- Landing con cards (Nuevo proyecto, Proyectos), empty state con icono y CTA "Crear primer proyecto", iconos lucide-react en header y botones.
- **Documentos en markdown (MDD, Blueprint, Contratos API, Flujos, Infra):** cada uno en su pestaña en el Workshop; previsualización por defecto, botón "Ver fuente" para editar el markdown, auto-guardado con debounce (1,5 s) y persistencia vía PATCH al proyecto; botón "Regenerar" para regenerar desde el MDD (Blueprint, Contratos API, Casos de Uso y Flujos, Infraestructura y Despliegue). Con **`complexity === LOW`** se ocultan pestañas MDD, Blueprint y API; **Generar entregables** llama a `POST /projects/:id/generate-deliverables` (cascada según complejidad).
- **Guía UX/UI:** en proyectos **NEW**, la API pide al modelo la sección **## Prompt para Google Stitch (producto)** (MDD + SDD en contexto); en **LEGACY** no se genera bloque Stitch. El botón "Generar" del tab usa un mensaje acorde (`uxGuideOneShotChatPrompt` en `WorkshopView`).
- **Responsive:** lista de proyectos y modales usable en móvil (`100dvh`, `viewport-fit=cover`, targets táctiles). Workshop: en `lg+` sigue el grid de 3 columnas; debajo, barra inferior Chat / Docs / Estado.
- Proxy `/api` al backend en **dev** (`vite.config.ts`). En **prod con Traefik** (Dokploy/Coolify), el proxy enruta `/api` al contenedor API; el nginx de la imagen web **solo** estáticos (`nginx.conf`). **Local full-docker** y **Coolify (modo single-host)** usan `nginx.local.conf` (proxy `/api` → `theforge-api`). Sin proxy delante, define `VITE_API_URL` en build.
- **Nginx (`nginx.conf`):** `/assets/*` no usa el fallback del SPA (`try_files` solo sirve ficheros reales) para que un chunk faltante no se sustituya por `index.html` (error de MIME `text/html` en módulos JS). `index.html` va con `Cache-Control: no-cache` para alinear shell y hashes tras cada deploy.
- **Healthcheck (Docker/Dokploy):** en `docker-compose.yml`, `wget --spider http://theforge-web:80/` (DNS del servicio). No uses `127.0.0.1` en el health de Dokploy UI (es el host). Swarm: `http://localhost:80/`.
- **Estimación MXN:** `src/utils/costCalculator.ts` delega en `@theforge/business-rules` (misma lógica que el API). Vite resuelve `@theforge/business-rules` y `@theforge/shared-types` (barril y subpaths) al **fuente** del monorepo (`vite.config.ts` + `tsconfig` paths) para que Rollup no falle con re-exports CJS del `dist` (p. ej. `deliverableStepLabelsForComplexity`, wizard SSOT `mdd-governance-patterns`).

`pnpm run dev:web` o `pnpm --filter @theforge/web dev` (desde la raíz) → http://localhost:5173
