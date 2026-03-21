# Plan de implementación: Integración TheForge en la aplicación web TheForge

**Estado (2026):** Gran parte de este plan ya está en el código (`modules/relic`, `legacy-flow`, tipo de proyecto, Workshop). Usar el repo como fuente de verdad; este documento conserva el desglose por capas y decisiones de diseño.

**Objetivo original:** Permitir en la aplicación web (no solo en Cursor) trabajar **proyectos legacy** usando el MCP de TheForge (AriadneSpecs), distinguiendo desde la entrada entre **proyecto nuevo** (flujo actual SADD) y **proyecto existente/legacy** (documentación de cambios con grafo indexado).

**Referencia MCP TheForge:** `docs/integración relic/relic.md` — herramientas `list_known_projects`, `validate_before_edit`, `get_legacy_impact`, `get_contract_specs`, `get_component_graph`, `ask_codebase`, etc.

---

## 1. Resumen de alcance

| Área | Qué se hace |
|------|--------------|
| **Entrada en web** | Usuario elige: "Producto nuevo" (flujo actual) o "Producto legacy (TheForge)". Si existente → listado de proyectos indexados en TheForge → al elegir uno se crea proyecto TheForge vinculado. |
| **Backend** | Cliente MCP contra TheForge (HTTP); endpoint para listar proyectos TheForge; modelo `Project` con tipo (NEW \| LEGACY) y `relicProjectId`; flujo de chat distinto para legacy (prompt + enriquecimiento de contexto vía MCP). |
| **Agentes** | **Nuevo:** flujo actual (entrevista → MDD → semáforo → entregables). **Legacy:** mismo canal de chat pero system prompt y contexto orientados a documentación de cambios; el backend llama al MCP y inyecta resultados en el contexto del LLM. |

---

## 2. Supuestos y dependencias

- **TheForge MCP** está accesible desde la API (URL configurable, p. ej. `https://theforge.obp.mx/mcp`). Si el MCP usa Streamable HTTP, el backend usará un cliente HTTP/SSE compatible; si TheForge expone un wrapper REST de las herramientas, se usará ese REST.
- **Autenticación:** TheForge requiere un **token M2M** (machine-to-machine). El backend debe enviarlo en cada petición al MCP (header `Authorization: Bearer <token>` o el que indique TheForge). La variable de entorno es **`MCP_AUTH_TOKEN`**. **El token no debe commitearse:** configurarlo solo en `.env` local o en los secrets del despliegue.
- **Proyectos legacy en TheForge** no requieren semáforo VERDE ni generación de entregables tipo Blueprint/OpenAPI desde cero; el foco es documentación de cambios, changelog, impacto de refactors y deuda técnica.

---

## 3. Cambios por capa

### 3.1 Base de datos (Prisma)

- **Modelo `Project`:**
  - Añadir `projectType`: enum `NEW` \| `LEGACY` (default `NEW`).
  - Añadir `relicProjectId`: `String?` (UUID del proyecto en el grafo TheForge; solo usado si `projectType === LEGACY`).
- **Migración:** Crear migración con el enum y los dos campos. El campo `projectType` lleva `DEFAULT 'NEW'` en SQL, así que **todos los proyectos ya existentes en BD quedarán con `projectType = NEW`** al aplicar la migración; `relicProjectId` queda NULL.

### 3.2 API — Cliente TheForge (MCP)

- **Nuevo módulo `theforge`** (o `relic-mcp`) en `apps/api`:
  - **TheForgeMcpClient** (o servicio equivalente): conecta al servidor MCP de TheForge por URL.
  - Métodos que encapsulan herramientas MCP mínimas para esta fase:
    - `listKnownProjects(): Promise<Array<{ id: string; name: string; rootPath?: string }>>` → herramienta `list_known_projects`.
    - Opcional para siguientes fases: `validateBeforeEdit(nodeName: string, projectId: string)`, `getLegacyImpact(...)`, `getContractSpecs(...)`, `askCodebase(question: string, projectId: string)`.
  - Configuración: `THEFORGE_MCP_URL` (obligatorio para usar TheForge), `MCP_AUTH_TOKEN` (token M2M; obligatorio para que las llamadas al MCP sean autorizadas). El cliente debe enviar el token en cada petición (p. ej. header `Authorization: Bearer <MCP_AUTH_TOKEN>`).
  - Si el SDK `@modelcontextprotocol/sdk` ofrece cliente Streamable HTTP por URL, usarlo; si no, implementar llamadas HTTP/SSE al endpoint según la especificación MCP (Streamable HTTP) para invocar herramientas.
- **Manejo de errores:** Si TheForge no está configurado o no responde, `listKnownProjects` devuelve array vacío o error controlado; la UI no debe romperse.

### 3.3 API — Endpoints TheForge

- **GET `/relic/projects`** (o bajo `ai-orchestrator` si se prefiere, p. ej. `GET /ai-orchestrator/relic/projects`):
  - Llama a `listKnownProjects()` del cliente TheForge.
  - Respuesta: `{ projects: Array<{ id: string; name: string; rootPath?: string }> }`.
  - Si TheForge no está configurado o falla: devolver `{ projects: [] }` y opcionalmente un flag `theforgeAvailable: false` para que la UI oculte o deshabilite "Proyecto existente".

### 3.4 API — Proyectos y creación

- **POST `/projects`:**
  - Extender body con opcionales: `projectType?: 'NEW' | 'LEGACY'`, `relicProjectId?: string`.
  - Validación: si `projectType === 'LEGACY'`, `relicProjectId` debe estar presente y ser un UUID; si `projectType === 'NEW'` (o no enviado), ignorar `relicProjectId`.
  - `ProjectsService.create` y Prisma: persistir `projectType` y `relicProjectId`.
- **GET `/projects` y GET `/projects/:id`:**
  - Incluir en la respuesta `projectType` y `relicProjectId` para que el front pueda mostrar badge "Legacy" y saber si debe usar flujo legacy.

### 3.5 API — Flujo de chat (orchestrator / sessions)

- **Distinción por tipo de proyecto:**
  - En `AiOrchestratorService.chat` y `chatStream`: al cargar el proyecto, leer `project.projectType` y `project.relicProjectId`.
  - **Si `projectType === 'NEW'`:** Comportamiento actual sin cambios (delegar a `SessionsService.chat` con el flujo actual de MDD/entrevista).
  - **Si `projectType === 'LEGACY'`:**
    - Usar un **system prompt específico para legacy** (documentación de cambios, changelog, impacto, uso del grafo; no inventar props/contratos; si el grafo devuelve `[NOT_FOUND_IN_GRAPH]` indicarlo).
    - **Enriquecimiento de contexto:** Antes de llamar al LLM, opcionalmente llamar al MCP según el mensaje del usuario:
      - Si el usuario menciona un componente/función concreta: llamar `validate_before_edit(nodeName, relicProjectId)` o `get_legacy_impact` + `get_contract_specs` y añadir el resultado al contexto (p. ej. en system prompt o en un bloque "Contexto TheForge" en el último mensaje).
      - Para preguntas genéricas ("cómo funciona X"): opcionalmente `ask_codebase(question, relicProjectId)` y inyectar la respuesta en contexto.
    - El chat legacy puede seguir usando las mismas pestañas de documentos (MDD, Blueprint, etc.) pero con contenido orientado a **documentación de cambios**; no es obligatorio bloquear pestañas, solo adaptar el prompt y el contexto.
- **Implementación práctica del enriquecimiento:** Un servicio `TheForgeContextService` (o integrado en el módulo relic) que, dado `relicProjectId` y el mensaje del usuario (y opcionalmente el historial), decida si extraer nombres de nodos y llamar a las herramientas MCP; devuelve un string "Contexto TheForge: ..." que el orchestrator o SessionsService añade al system prompt o al mensaje antes de `ai.generateResponse` / `generateResponseStream`.

### 3.6 Shared-types

- Añadir en DTOs de proyecto:
  - `projectType?: 'NEW' | 'LEGACY'` y `relicProjectId?: string | null` en `createProjectSchema` (opcionales) y en `updateProjectSchema` (opcionales).
  - Incluir en `projectResponseSchema` (y tipos que expongan proyecto) `projectType` y `relicProjectId`.

### 3.7 Frontend (web)

- **Landing / lista de productos:**
  - Distinguir claramente **dos entradas:**
    1. **"Producto nuevo"** — igual que ahora: input nombre + botón Crear → crea Producto con `projectType: 'NEW'` y abre Workshop.
    2. **"Producto existente (TheForge)"** — botón o enlace que abre un flujo (modal o página) donde:
       - Se llama a `GET /relic/projects`.
       - Se muestra lista de proyectos indexados (nombre, opcionalmente rootPath).
       - Al seleccionar uno, se hace `POST /projects` con `name` (p. ej. el nombre del proyecto TheForge), `projectType: 'LEGACY'`, `relicProjectId: <id>`.
       - Se abre el Workshop con ese proyecto (igual que hoy con `projectId`).
  - Si `GET /relic/projects` devuelve `theforgeAvailable: false` o lista vacía y no hay configuración, se puede ocultar o deshabilitar "Proyecto existente" y mostrar un mensaje tipo "TheForge no configurado".
- **Workshop:**
  - Si el proyecto tiene `projectType === 'LEGACY'` (y opcionalmente `relicProjectId`), mostrar un **badge o indicador "Legacy"** (y el nombre del proyecto TheForge si se guardó) para que el usuario sepa que está en modo documentación de cambios.
  - El resto del Workshop (chat, pestañas, etc.) funciona igual; la diferencia está en el backend (prompt + contexto MCP). No es obligatorio en esta fase cambiar la UI del chat para legacy más allá del badge.

### 3.8 Configuración y env

- **API:**
  - `THEFORGE_MCP_URL`: URL del servidor MCP (p. ej. `https://theforge.obp.mx/mcp`). Si no está definida, el módulo TheForge no hace llamadas y `listKnownProjects` devuelve vacío (o endpoint devuelve `theforgeAvailable: false`).
  - `MCP_AUTH_TOKEN`: Token M2M para autenticación con TheForge. **No commitear:** solo en `.env` o secrets del despliegue. Sin este token las llamadas al MCP fallarán por no autorizadas.
- **Docker:** `THEFORGE_MCP_URL` y `MCP_AUTH_TOKEN` están en `docker-compose.yml` para el servicio `api`; el token se inyecta vía env (ej. secret en Dokploy).

---

## 4. Orden sugerido de implementación (fases)

| Fase | Descripción | Entregable |
|------|-------------|------------|
| **1** | Modelo de datos + shared-types | Prisma: `projectType`, `relicProjectId`; migración; DTOs y response con estos campos. |
| **2** | Cliente MCP TheForge en API | Módulo `relic` con `TheForgeMcpClient`, implementación de `listKnownProjects()` contra `THEFORGE_MCP_URL`. Manejo de no configurado / error. |
| **3** | Endpoint listado proyectos TheForge | GET `/relic/projects` (o bajo ai-orchestrator) que use el cliente y devuelva `{ projects: [...] }` y opcionalmente `theforgeAvailable`. |
| **4** | Creación de proyecto legacy desde API | POST `/projects` acepta `projectType` y `relicProjectId`; GET proyectos incluye estos campos. |
| **5** | Entrada en web: proyecto nuevo vs existente | Landing con dos flujos; "Proyecto existente" → llamada a GET relic/projects → selector → POST projects con LEGACY + relicProjectId → abrir Workshop. |
| **6** | Workshop: badge Legacy | Si `projectType === 'LEGACY'`, mostrar indicador "Legacy" (y nombre TheForge si aplica). |
| **7** | Flujo de chat legacy en backend | System prompt legacy; enriquecimiento de contexto vía MCP (TheForgeContextService + llamadas a validate_before_edit / get_legacy_impact / ask_codebase según mensaje); integración en orchestrator/sessions para proyectos LEGACY. |

Las fases 1–6 dejan la app usable: elegir proyecto nuevo o legacy, listar TheForge, crear proyecto legacy y abrir Workshop con badge. La fase 7 hace que el chat en modo legacy use realmente el grafo (documentación de cambios con contexto TheForge).

---

## 5. Criterios de aceptación (resumen)

- [x] Usuario puede elegir "Proyecto nuevo" o "Proyecto existente (TheForge)" desde la web.
- [x] Si elige existente, ve la lista de proyectos indexados en TheForge (desde el MCP) y al elegir uno se crea un proyecto TheForge tipo LEGACY vinculado por `relicProjectId`.
- [x] En el Workshop se distingue visualmente un proyecto legacy (badge/indicador).
- [x] El chat para proyectos legacy usa prompt y contexto enriquecido con datos del MCP (`ask_codebase` inyectado en system prompt) para documentación de cambios sin inventar contratos.
- [x] Si TheForge no está configurado o no responde, el modal muestra mensaje claro; el flujo "Proyecto nuevo" no se ve afectado.
- [x] Documentación: README de la carpeta y del módulo `theforge`; env y despliegue documentados (THEFORGE_MCP_URL, MCP_AUTH_TOKEN).

---

## 6. Riesgos y mitigación

| Riesgo | Mitigación |
|--------|------------|
| MCP solo documentado para Cursor (stdio/URL en mcp.json) | Verificar si TheForge expone el mismo endpoint por HTTP/SSE; si solo stdio, necesitar un proxy o adaptador en el backend que hable con TheForge. |
| Latencia por llamadas MCP en cada mensaje | En fase 7, enriquecer solo cuando el mensaje lo justifique (p. ej. detectar nombres de componentes); cachear por sesión si es viable. |
| TheForge requiere autenticación no documentada | **Resuelto:** auth por token M2M; env `MCP_AUTH_TOKEN`; enviar en header que indique TheForge (p. ej. `Authorization: Bearer`). |

---

## 7. Documentación a actualizar

- **`docs/integración relic/relic.md`:** Añadir sección "Uso desde la aplicación web TheForge" que enlace a este plan y al flujo (listado → crear proyecto legacy → chat con contexto MCP).
- **`docs/THEFORGE-INDEX.md`:** En §6 (Despliegue) añadir variables `THEFORGE_MCP_URL` (y si aplica `RELIC_API_KEY`).
- **`docs/integración relic/README.md`:** Crear o actualizar con índice: relic.md (qué es TheForge y herramientas MCP), PLAN-IMPLEMENTACION-RELIC-WEB.md (este plan).

Cuando este plan esté aprobado al 100%, se puede bajar a tareas concretas (issues o checklist por fase) e implementar en la rama `relic-integration`.
