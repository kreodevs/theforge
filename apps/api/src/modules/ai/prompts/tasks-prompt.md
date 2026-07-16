# Contexto #

El **MDD es la Constitución del proyecto** (7 secciones §1–§7); el **Blueprint es el Plan técnico**. Insumos: MDD, Blueprint y, si el mensaje de usuario los incluye, Spec, User Stories, Contratos API, Flujos e Infra ya generados. Las tareas deben derivarse de **todos** esos artefactos y reflejar los **patrones [X]** del Wizard del MDD (user prompt).

# Objetivo #

Generar el **documento Tasks** (breakdown de implementación) en markdown: lista de tareas derivadas del MDD y del Blueprint, listas para ser ejecutadas. Cada ítem debe ser una tarea accionable (ej. "Implementar endpoint POST /api/auth/login según contrato", "Crear vista Login con formulario y validación"). No repitas el contenido del MDD o Blueprint literalmente; deriva tareas concretas.

**Contenido obligatorio (secciones con ítems comprobables):**

1. **Backend tasks:** Solo trabajo que corre en **servidor**: API (controllers/routes/services), persistencia (ORM, migraciones, `schema.prisma`, Strapi `src/api/**/content-types/**/schema.json`), validación en capa API, jobs server-side.
2. **Frontend tasks:** Todo lo que corre en **cliente**: pantallas, componentes, hooks, estado UI, formularios, llamadas `fetch` desde el navegador, **tipos TypeScript / carpetas `Models` o `types` que viven bajo el árbol de la app front** (p. ej. `apps/web`, `packages/login-sso`, `src/components`, SPA `src/` cuando el inventario muestra que es Vite/React y no el servidor).
3. **Infraestructura tasks:** Variables de entorno, Docker/despliegue, CI/CD, pasos de configuración.
4. **Testing tasks (§8):** Unit tests (Jest/Vitest) por cada módulo CRUD, integration tests para Auth/RBAC/RLS, E2E tests para flujos críticos (login → sesión → mensaje), load tests para colas (BullMQ/similar). Cada task de test DEBE tener: `target_files` apuntando al archivo de test, `dependencies` sobre la task de implementación correspondiente, `verification` con el comando para ejecutar el test suite.
5. **Deploy tasks (§9):** Dockerfile multi-stage optimizado, CI/CD pipeline (GitHub Actions / GitLab CI), cloud deploy (ECS Fargate / Cloud Run según §7), monitoring setup (Sentry, health checks), variables de entorno en secrets manager. Cada task de deploy DEBE incluir `target_files` con los archivos de configuración de infra/CI.
6. **Opcional – Integración/QA:** Pruebas de integración, criterios de aceptación por flujo.

**Clasificación Backend vs Frontend (crítico):** No uses el nombre del archivo (`cliente.ts`, `Model`) para decidir la sección. Usa la **ruta completa** y el **stack** del Blueprint o del contexto TheForge: si la ruta está en el paquete o carpeta del **frontend**, el ítem va en **Frontend tasks**, aunque el archivo modele datos. La persistencia real del campo (BD / API Strapi / Nest) va en **Backend**. Si un mismo cambio toca ambos, crea **dos** ítems (uno por capa).

# Alineación MDD (7 secciones — obligatoria) #

Cada tarea debe ser **trazable** a al menos una fuente. Incluye en el texto de la tarea (o en sub-bloques bajo el ítem) campos explícitos:

- **`MDD:`** sección y ancla (ej. `§4 POST /api/v1/leads`, `§3 entidad users`, `§6 MFA TOTP`, `§7 Docker compose`).
- **`Story:`** user story o HU cuando exista en el mensaje (ej. `US-002 Login`, `HU-3.1 Crear lead`).
- **`Archivo:`** ruta cuando aplique (ver Estilo spec-kit).

**Cobertura mínima por sección MDD (no omitir si el MDD la describe):**

| Sección MDD | Qué debe generar Tasks |
|-------------|------------------------|
| §1 Contexto / capacidades MVP | User stories o bloques por capacidad; tareas de feature end-to-end |
| §2 Arquitectura / stack | Tareas de bootstrap, módulos, capas, dependencias |
| §3 Modelo de datos | Tarea por entidad/tabla: migración, ORM, DTOs, validación |
| §4 Contratos API | Tarea por endpoint (método + ruta): controller, service, DTO, tests |
| §5 Lógica / edge cases | Tareas por flujo Mermaid o regla de negocio; casos borde explícitos |
| §6 Seguridad | Auth, roles, MFA, secrets, CORS, rate limit según MDD |
| §7 Infraestructura | Env, Docker, CI/CD, observabilidad, backups |

Si el mensaje incluye **Contratos API**, **Flujos**, **Infra** o **User Stories** ya generados, **no ignores** ningún endpoint, flujo, servicio o HU listado allí: crea tareas que los implementen o verifiquen.

# Cobertura exhaustiva (obligatoria cuando el MDD describe MVP completo) #

1. **Tarea comprobable** (`- [ ]`) por capacidad MVP de §1, dominio API de §4, entidad de §3, flujo de §5, control de §6 e ítem de §7 que requiera trabajo.
2. Separa **obligatoriamente** en secciones H2 canónicas: `## Backend tasks`, `## Frontend tasks`, `## Infraestructura tasks` (o `## Infra tasks`), `## Testing tasks`, `## Deploy tasks`. **Prohibido** usar solo `## Fase N` como secciones principales; las fases van como `### Fase N` **dentro** de cada sección canónica.
3. **Migraciones §3:** Por cada tabla/columna `UNIQUE` o `NOT NULL` del MDD, incluye tarea explícita de migración TypeORM/Prisma + entity/DTO.
4. **Open gaps research:** Cada ítem de «Análisis de Gaps» o `[OPEN-GAP]` del research → tarea correctiva con trazabilidad.
5. **Eventos RabbitMQ/EDA:** Si el plan menciona bus de eventos, incluye tasks publisher + consumer + test de integración.
6. **Volumen orientativo:** 12+ capacidades → espera **30+ tareas** repartidas en las tres secciones; 5+ endpoints → al menos una tarea Backend por endpoint.
7. **Checklist del mensaje:** Si el prompt incluye «CHECKLIST DE COBERTURA OBLIGATORIA», recorre **cada** ítem `- [ ]` y emite al menos una tarea trazable antes de cerrar el documento.
8. **Prohibido** omitir entregables que existan en MDD, Blueprint, Spec o bloques adjuntos del mensaje.
9. **API contracts:** Usa **exactamente** método + ruta de `api-contracts.md`. No inventes alias (`mcp-capabilities`, `webhooks/whatsapp`, etc.) si el contrato dice `mcp-plugins`, `whatsapp/webhook`, etc.
10. **Pantallas:** Si el mensaje incluye `pantallas.md`, genera **≥1 tarea Frontend por ruta principal** con `section: Frontend` en YAML.

# Estilo (formato spec-kit) #

Accionable y comprobable. Usa el layout compatible con [github/spec-kit tasks-template](https://github.com/github/spec-kit):

## Estructura del documento

1. **`# Tasks`** — título raíz.
2. **Secciones por user story** — `## User Story: <nombre corto>` (o `## US-001: <nombre>`).
3. **Checkpoint por user story** — tras los ítems de una story, añade una línea `**Checkpoint**: <criterio verificable>` (smoke test de esa story).
4. **Tareas en checklist** — `- [ ]` para pendientes, `- [x]` para hechas.
5. **Paralelización** — prefija con `[P]` las tareas que pueden ejecutarse en paralelo **dentro del mismo checkpoint** (misma user story, sin dependencias entre ellas). Ejemplo: `- [ ] [P] Crear DTO en src/dtos/foo.ts`.
6. **Rutas de archivo** — cada tarea DEBE incluir al menos una ruta cuando aplique: `**Archivo:** src/...` o backticks `` `src/...` `` en el texto de la tarea.

## Secciones técnicas (además de user stories)

Incluye también bloques agregados si el plan lo requiere:

- **Backend tasks** — API, persistencia, jobs servidor.
- **Frontend tasks** — UI, hooks, estado cliente.
- **Infraestructura tasks** — env, Docker, CI/CD.

Puedes anidar user stories dentro de Backend/Frontend o usar user stories como secciones principales con subtareas etiquetadas `[Backend]` / `[Frontend]` — pero **siempre** con checkpoints y rutas.

# Tono #

Neutro. Documento de planificación para ejecución.

# Audiencia #

Equipo de desarrollo (backend, frontend, DevOps) que ejecutará las tareas.

# Respuesta #

- **Solo markdown.** El **primer carácter** debe ser `#`. Sin introducciones ni texto conversacional antes del documento.
- Documento completo con user stories (o secciones Backend/Frontend/Infra) usando checklist, `[P]` donde aplique, rutas de archivo, **Checkpoint** por user story y trazabilidad **MDD:** / **Story:** en cada ítem.

# Proyecto legacy (mensaje con contexto TheForge) #

Si el **mensaje de usuario** trae **Contexto del codebase (TheForge)**, cada tarea debe incluir **al menos una ruta de archivo** del repo (como aparece en TheForge) **o** un identificador inequívoco del índice (endpoint + método, content-type, componente con path). Las secciones **Archivo del plan** e **Inventario** del bloque TheForge tienen prioridad. No mezcles archivos de dominios distintos salvo que TheForge + MDD lo justifiquen.

**Backend multi-stack:** deduce del contexto si el API es Strapi, Nest, u otro. Para **cambios de modelo/campo**: en Strapi la tarea debe apuntar a `schema.json` del content-type, no a `lifecycles.js` (salvo que el trabajo sean hooks). En Nest/Prisma/TypeORM, apunta a entidades, DTOs o `schema.prisma` según lo que TheForge muestre. No atribuyas rutas “que suenan bien” en la misma carpeta si otra extensión es la fuente de verdad del esquema.

**No confundir capas:** Si TheForge muestra `src/Models/cliente.ts` (o similar) **dentro del repo o paquete de la SPA**, esas tareas son **Frontend** (tipos, validación de formulario, mapeo UI). Solo si la misma ruta o el inventario demuestran que es **código de servidor** (p. ej. `apps/api/src/...`, Strapi `src/api/...`) van en **Backend**.

## Coordenadas exactas (cuando hay contexto TheForge o Blueprint detallado) ##

**CRÍTICO:** Cada tarea DEBE incluir coordenadas precisas del cambio cuando sea posible:

- **Archivo:** Ruta exacta del archivo a modificar (ej. `src/components/ClientForm.tsx`).
- **Función o componente:** Nombre de la función/clase/componente a modificar (ej. `handleSubmit()`, `ClientForm`).
- **Línea sugerida:** Línea o posición relativa donde insertar el cambio (ej. "después de la línea 142 (campo teléfono)").
- **Cambio esperado:** Descripción del cambio o diff sugerido.

**Formato por tarea (ejemplo):**

```
## T-001: Agregar campo descuento a formulario de alta
**MDD:** §3 entidad clients — campo discount
**Story:** US-004 Alta de cliente
**Archivo:** src/components/ClientForm.tsx
**Función:** render (o handleSubmit)
**Línea:** después de línea 142 (campo teléfono)
**Cambio:**
```diff
+ <FormField name="discount" label="Descuento (%)" type="number" required min={0} max={100} />
```
**Endpoint:** POST /api/clients — agregar campo `discount` al body
**DTO:** src/dtos/create-client.dto.ts — agregar `discount: number`
**Validación:** min 0, max 100
**Afecta también:** /clients/:id/edit (mismo campo en edición)
```

Si no se puede determinar la línea exacta, al menos indicar el archivo, la función y **MDD:**. Nunca inventes coordenadas — si no las sabes, omítelas.

# Formato YAML front-matter v2 (obligatorio para Agentes IA) #

Cada tarea DEBE tener un **bloque YAML front-matter** al inicio (entre `---`), justo antes del checklist. Esto permite que agentes de código (Cursor/Claude) ejecuten la tarea automáticamente.

**Ejemplo completo de una tarea v2:**

```markdown
---
id: T-001
section: Backend
title: Crear endpoint POST /api/auth/login
target_files:
  - apps/api/src/modules/auth/auth.controller.ts
  - apps/api/src/modules/auth/auth.service.ts
change_type: create
dependencies: []
parallel: true
estimated_minutes: 60
mdd_ref: §4 POST /api/auth/login
story_ref: US-001
language: TypeScript
inference_rules:
  - crud-auto
verification:
  command: curl -X POST http://localhost:3000/api/auth/login -d '{"email":"a","password":"b"}'
  expectedOutput: "token"
  checklist:
    - Devuelve JWT válido
    - Valida email/password
    - Usa bcrypt
---

- [ ] [P] Crear endpoint POST /api/auth/login
  - Crear `auth.controller.ts` con método `login()`
  - Crear `auth.service.ts` con `validateUser()` + `generateToken()`
```

**Campos del YAML front-matter (obligatorios):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | Identificador único (T-001, T-002…). |
| `section` | string | `Backend`, `Frontend`, `Infra`, `QA`, `Integración`. |
| `title` | string | Título accionable (máx. 80 chars). |
| `target_files` | string[] | Archivos a modificar/crear (rutas relativas). |
| `change_type` | enum | `create`, `modify`, `delete`, `append`, `insert`, `replace`, `run`, `configure`, `generate`, `install`, `rename`, `merge`. |
| `dependencies` | string[] | IDs de tareas que DEBEN terminarse antes (ej. `[T-001, T-002]`). |
| `inference_rules` | string[] | Reglas de inferencia automática (ej. `["crud-auto"]` para que el agente derive operaciones CRUD restantes). |
| `verification` | object | `command`, `expectedOutput`, `checklist[]` — cómo verificar que la tarea está completa. |

**Campos opcionales:** `parallel` (bool, default false), `estimated_minutes` (int), `story_ref` (string), `mdd_ref` (string), `language` (string).

**Reglas del formato:**
1. El bloque YAML va **antes** de cada tarea (entre `---`), NUNCA al final ni en medio del contenido Markdown.
2. `target_files` debe incluirse SIEMPRE que haya archivo relevante. Si es una tarea conceptual, usa `target_files: []`.
3. `change_type`:
   - `create` → archivo/entidad nuevo.
   - `modify` → cambio en archivo existente.
   - `append` → añadir al final.
   - `insert` → insertar en posición específica.
   - `replace` → reemplazar contenido existente.
   - `delete` → eliminar archivo/función.
   - `run` → ejecutar comando (build, test, migrate).
   - `configure` → modificar config/env.
4. `inference_rules` indica al agente qué puede auto-derivar. Ejemplos: `["crud-auto"]` (genera POST/GET/PUT/DEL automáticamente desde uno solo), `["soft-delete"]` (agrega `deletedAt` a tablas), `["dto-from-model"]` (genera DTOs desde schema).
5. Después del YAML, el Markdown normal sigue igual: `- [ ] [P] Título` con descripción, archivos, estado, etc.
6. **Todos los ejemplos anteriores de coordenadas y formato de tareas siguen siendo válidos** — ahora se envuelven con el front-matter YAML al inicio.

**El prompt DEBE generar TODAS las tareas con YAML front-matter — esto es crucial para la compatibilidad con agentes de ejecución automática.**

# UI accionable (Tasks) #

- Desglosa **Frontend tasks por pantalla** (`pantallas.md`), no por tabla de BD ni tareas genéricas «Implementar frontend».
- **Una tarea = una pantalla o flujo modal acotado.** Formato obligatorio:

```markdown
- [ ] [P] UI `/strategies` — DataTable + StrategyForm + PaginationBar (US-003)
  - **Archivos:** apps/frontend/src/pages/StrategiesPage.tsx, ...
  - **Estados:** empty, loading, error
  - **API:** GET/POST/PUT /strategies
  - **DS:** tokens §design-system, componentes §pantallas
```

- Cada tarea UI debe citar: ruta, **componentes UI** (catálogo MCP activo o shadcn), **API** de api-contracts (no inventar `/api/v1/{tabla}`).
- Incluye subtareas de estados `loading`, `empty`, `error`, `success` en pantallas críticas (login, dashboard, formularios, side-effects).
- Orden sugerido: por rol/journey → por ruta React Router.

# Exactitud de dominio (PLAN-CASCADE-90-ACCURACY) #

1. **Anti-sesgo auth:** Si el MDD/BRD describen un producto de dominio (WhatsApp, MCP, multi-agente, CRM, bitácora, etc.), **≥70 %** de las tasks deben trazar a ese dominio — no solo LDAP/MFA/RBAC/Outbox.
2. **CRUD:** Por cada entidad MVP de §3 que no sea glue (`outbox_events`, `sessions`), incluye tasks de persistencia + API + (si aplica) UI.
3. **Procesos:** Cada flujo crítico de §5 / Logic Flows → al menos una task Backend con edge cases.
4. **Pantallas complejas:** Si pantallas.md o el dominio piden chat/HITL/MCP wizard, crea tasks Frontend específicas (no solo DataTable genérica).
