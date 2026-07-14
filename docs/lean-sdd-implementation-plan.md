# Lean SDD: Plan de Implementación Detallado (v2.0)

> **Rama:** `lean-sdd`  
> **Fecha:** 2026-07-14  
> **Autor:** TheForge AI  
> **Estado:** DRAFT — Listo para revisión  
> **Meta:** Specs que producen 85%-90% de código sin fallas via Cursor/Claude

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Análisis de Brechas Actual](#2-análisis-de-brechas-actual)
3. [Nueva Arquitectura Documental](#3-nueva-arquitectura-documental)
4. [Formato de Tasks Ejecutable por Agents](#4-formato-de-tasks-ejecutable-por-agents)
5. [Patrones de Inferencia Declarativa](#5-patrones-de-inferencia-declarativa)
6. [Pipeline de Generación Optimizado](#6-pipeline-de-generación-optimizado)
7. [Fases de Implementación](#7-fases-de-implementación)
8. [Plan de Cambios en Prompts](#8-plan-de-cambios-en-prompts)
9. [Checklist de Validación](#9-checklist-de-validación)

---

## 1. Resumen Ejecutivo

### El problema

El stack documental actual de TheForge genera specs de alta calidad para lectura humana, pero **baja calidad para inferencia automática** por agentes de código. Los principales puntos de fallo son:

1. **Tasks no tienen estructura de datos computable** — son markdown libre que un humano interpreta bien, pero un agente no puede parsearlos con certeza para saber qué archivo editar, qué función crear, ni qué tipo de dato usar.
2. **Falta metadatos de CRUD** — el MDD describe tablas pero no declara "esta entidad requiere CRUD completo con paginación, búsqueda y soft-delete". El agente no sabe si debe crear endpoints REST o solo una tabla.
3. **No hay contratos de tipos fuertes** — los schemas de Zod/Prisma están en texto plano, no en un formato que un parser pueda consumir para generar interfaces TypeScript.
4. **Los prompts son optimizados para LLMs conversacionales, no para LLMs de código** — instrucciones como ">=8 viñetas sustantivas" son métricas de calidad para humanos, no señales de control para agents.

### La solución

Convertir el pipeline de documentos de TheForge en un **sistema de producción de código** donde:

- Cada entidad del MDD lleva **metadatos de operación** (CRUD, búsqueda, paginación, soft-delete, RBAC, etc.)
- Cada tarea es **un contrato ejecutable** con: archivo objetivo, tipo de cambio (crear/modificar/eliminar), snippet de código esperado, y dependencias exactas
- Los prompts generan **código parcial** (stubs, interfaces, schemas) que el agente completa, en lugar de instructivos en prosa
- El spec-kit incluye un **`types.json`** derivado del MDD que funciona como fuente de verdad tipada

### Stack documental objetivo (5 capas)

```
[CAPA 1: NEGOCIO]
└── Blueprint (macro) — se mantiene

[CAPA 2: CONSTITUCIÓN + CONTRATOS]
├── MDD §1-§7 (markdown) — se mantiene
├── types.json (derivado de §3) — NUEVO
└── operations.json (derivado de §1+§3) — NUEVO

[CAPA 3: COMPORTAMIENTO]
├── User Stories + Flujos Dinámicos (enriquecidos con cognitive_load) — NUEVO FORMATO
└── Interaction Spec (fusión de HU + Flujos + UX Psicológica) — NUEVO

[CAPA 4: EJECUCIÓN]
└── tasks.md (formato ejecutable) — NUEVO FORMATO
    └── tasks.json (backend del parser) — NUEVO

[CAPA 5: INFRA]
└── Infra + Agent Governance — se mantiene
```

---

## 2. Análisis de Brechas Actual

### 2.1 MDD → Tasks (gaps críticos)

| Gap | Ubicación | Impacto | Solución |
|-----|-----------|---------|----------|
| Sin metadatos CRUD por entidad | MDD §3 | El agente no sabe qué operaciones crear | Añadir `operations: ['create','read','update','delete','list','search']` por entidad |
| Sin contrato de tipos parseable | MDD §3 + tasks.md | El agente no puede generar TypeScript interfaces | Generar `types.json` con Zod schemas estructurados |
| Tasks son markdown libre | tasks.md | El parser regex falla con formatos variados | Tasks con formato YAML front-matter + markdown cuerpo |
| Sin grapho de dependencias | tasks.md | El agente no sabe qué tarea va primero | Añadir `depends_on: ['T-001', 'T-002']` en cada tarea |
| Sin coordenadas de código | tasks.md legacy | El agente no sabe dónde insertar | Formato estándar: `target_file`, `target_function`, `insert_after`, `change_type` |
| Sin test específico por tarea | tasks.md | El agente no sabe cómo verificar | Cada tarea incluye `verification: { command, expected_output }` |
| Falta few-shot de implementación | prompts | El LLM no sabe el estilo de código esperado | Añadir ejemplos de código completo en prompts |

### 2.2 Prompt → LLM → Output (gaps críticos)

| Gap | Ubicación | Impacto | Solución |
|-----|-----------|---------|----------|
| Software Architect prompt >220 líneas | `mdd/software-architect-prompt.md` | Saturación del LLM, omite reglas | Dividir en 3 prompts especializados: Architect-Data, Architect-API, Architect-Flow |
| Tool calling deshabilitado para Architect | `tool-registry.ts` | Sin validación automática de SQL/API | Reactivar con fallback a "sin tools" si el modelo falla |
| Formato dual JSON/Markdown | `mdd-software-architect.node.ts` | Complejidad de parsing imposible de mantener | Forzar SIEMPRE markdown con YAML front-matter |
| Sin validación de tasks | `sdd-precision-checks.util.ts` | Tasks pueden ser incompletos | Crear `TaskAuditor` similar al MDD Auditor |
| Delivery Gate post-Auditor | `mdd-delivery-gate.util.ts` | Detecta errores muy tarde | Mover Delivery Gate antes del Auditor |

### 2.3 Spec-kit → Cursor/Claude (gaps críticos)

| Gap | Ubicación | Impacto | Solución |
|-----|-----------|---------|----------|
| Sin `types.json` en el bundle | `spec-kit-bundle.ts` | El agente no tiene schemas tipados | Incluir `specs/NNN-slug/types.json` |
| Sin `operations.json` | `spec-kit-bundle.ts` | El agente no sabe qué CRUD crear | Incluir `specs/NNN-slug/operations.json` |
| `quickstart.md` heurístico | `spec-kit-bundle.ts` | Puede recomendar comando erróneo | Generar desde §2 del MDD con validación de stack |
| Sin `.cursorrules` en el bundle | N/A | El agente no tiene reglas de estilo | Incluir `.cursorrules` derivado del MDD §2 |
| Sin instrucciones de test por task | `tasks.md` | El agente no sabe si su código funciona | Añadir bloque `test` en cada tarea |

---

## 3. Nueva Arquitectura Documental

### 3.1 Flujo de datos (antes y después)

**ANTES (actual):**
```
Usuario → Chat → MDD (markdown) → LLM → Tasks (markdown libre) → Agente humano
                                                     ↓
                                              Spec (what/why)
                                                     ↓
                                              Blueprint (plan)
```

**DESPUÉS (objetivo):**
```
Usuario → Chat → MDD (markdown + YAML) ──┬──→ types.json (Zod schemas)
                                         ├──→ operations.json (CRUD metadata)
                                         ├──→ interaction-spec.md
                                         └──→ tasks.md (ejecutable)
                                                      │
                                                      ↓
                                              tasks.json (parseado)
                                                      │
                                                      ↓
                                              Cursor/Claude (85-90% código)
                                                      │
                                                      ↓
                                              tests.md (validación)
```

### 3.2 Nuevos artefactos

#### 3.2.1 `types.json` (derivado de MDD §3)

Estructura:

```json
{
  "version": "1.0",
  "source": "mdd-section-3",
  "entities": [
    {
      "name": "User",
      "table": "users",
      "description": "Usuario de la plataforma",
      "fields": [
        {
          "name": "id",
          "type": "UUID",
          "dbType": "uuid PRIMARY KEY",
          "tsType": "string",
          "zodSchema": "z.string().uuid()",
          "nullable": false,
          "default": "gen_random_uuid()",
          "description": "Identificador único"
        },
        {
          "name": "email",
          "type": "EMAIL",
          "dbType": "varchar(255) UNIQUE NOT NULL",
          "tsType": "string",
          "zodSchema": "z.string().email()",
          "nullable": false,
          "validators": ["email", "unique", "not_null"],
          "description": "Correo electrónico del usuario"
        },
        {
          "name": "role",
          "type": "ENUM",
          "dbType": "varchar(20) DEFAULT 'user'",
          "tsType": "UserRole",
          "zodSchema": "z.enum(['user','admin','moderator'])",
          "nullable": false,
          "default": "user",
          "description": "Rol del usuario",
          "enumValues": ["user", "admin", "moderator"]
        },
        {
          "name": "createdAt",
          "type": "TIMESTAMP",
          "dbType": "timestamptz DEFAULT now()",
          "tsType": "Date",
          "zodSchema": "z.date()",
          "nullable": false,
          "default": "now()",
          "description": "Fecha de creación"
        },
        {
          "name": "deletedAt",
          "type": "TIMESTAMP_NULLABLE",
          "dbType": "timestamptz",
          "tsType": "Date | null",
          "zodSchema": "z.date().nullable()",
          "nullable": true,
          "description": "Soft-delete timestamp",
          "flags": ["soft_delete"]
        }
      ],
      "indexes": [
        { "fields": ["email"], "type": "btree", "unique": true },
        { "fields": ["role"], "type": "btree" },
        { "fields": ["createdAt"], "type": "btree", "order": "DESC" }
      ],
      "relations": [
        { "type": "hasMany", "target": "Project", "field": "userId", "inverse": "projects" },
        { "type": "hasMany", "target": "Session", "field": "userId", "inverse": "sessions" }
      ],
      "flags": ["auditable", "soft_deletable", "searchable"]
    }
  ],
  "enums": [
    { "name": "UserRole", "values": ["user", "admin", "moderator"] }
  ]
}
```

**Generado por:** LLM Formatter Node post-Architect, o Derived Spec Generator.

**Consumido por:** Cursor/Claude para generar: interfaces TS, DTOs, Zod schemas, Prisma models, API controllers, frontend forms.

#### 3.2.2 `operations.json` (derivado de MDD §1+§3)

Estructura:

```json
{
  "version": "1.0",
  "source": "mdd-sections-1-3",
  "operations": [
    {
      "entity": "User",
      "type": "crud",
      "routes": [
        { "method": "POST", "path": "/api/users", "action": "create", "auth": ["admin"], "body": "CreateUserDto" },
        { "method": "GET", "path": "/api/users/:id", "action": "read", "auth": ["admin", "self"], "params": ["id"] },
        { "method": "PATCH", "path": "/api/users/:id", "action": "update", "auth": ["admin", "self"], "params": ["id"], "body": "UpdateUserDto" },
        { "method": "DELETE", "path": "/api/users/:id", "action": "delete", "auth": ["admin"], "params": ["id"], "softDelete": true },
        { "method": "GET", "path": "/api/users", "action": "list", "auth": ["admin"], "pagination": { "type": "cursor", "pageSize": 20 }, "searchable": ["email", "name"], "sortable": ["createdAt", "email"] }
      ],
      "frontend": {
        "pages": [
          { "route": "/admin/users", "component": "UserListPage", "dataTable": true, "search": true, "filters": ["role", "createdAt"] },
          { "route": "/admin/users/:id", "component": "UserDetailPage", "tabs": ["profile", "activity", "settings"] },
          { "route": "/admin/users/:id/edit", "component": "UserEditPage", "form": "react-hook-form+zod" }
        ]
      }
    }
  ],
  "global_features": {
    "pagination": { "default": "cursor", "pageSizes": [10, 20, 50, 100] },
    "search": { "type": "fulltext", "minLength": 3 },
    "soft_delete": { "enabled": true, "restorable": true },
    "audit": { "fields": ["createdAt", "updatedAt", "createdBy", "updatedBy"] }
  }
}
```

**Generado por:** Derived Spec Generator (post-MDD Auditor).

**Consumido por:** Tasks generator para crear TODAS las tareas de CRUD automáticamente sin que el prompt las pida explícitamente.

#### 3.2.3 `tasks.md` (formato ejecutable)

Ver sección 4.

#### 3.2.4 `tasks.json` (parseado por backend)

Backend del parser para servir a Cursor/Claude vía MCP:

```json
{
  "version": "2.0",
  "tasks": [
    {
      "id": "T-001",
      "title": "Create User entity and migration",
      "description": "Implement User model in Prisma and run migration",
      "change_type": "create",
      "target_files": ["packages/database/schema.prisma"],
      "language": "prisma",
      "dependencies": [],
      "code_snippet": {
        "type": "prisma_model",
        "content": "model User {\n  id        String   @id @default(uuid())\n  email     String   @unique\n  role      String   @default(\"user\")\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}",
        "insert_after": null
      },
      "verification": {
        "command": "npx prisma migrate dev --name add_user",
        "expected_output": "Your database is now in sync with your schema"
      },
      "metadata": {
        "mdd_ref": "§3 User",
        "story_ref": "US-001",
        "operations": ["create"],
        "entity": "User",
        "estimated_minutes": 10,
        "parallel": false
      }
    }
  ]
}
```

---

## 4. Formato de Tasks Ejecutable por Agents

### 4.1 Estructura del documento (nuevo formato)

Cada tarea tiene **YAML front-matter** + **cuerpo markdown**:

```markdown
---
id: T-001
title: Create User entity and migration
change_type: create
target_files:
  - packages/database/schema.prisma
language: prisma
dependencies: []
parallel: false
estimated_minutes: 10
mdd_ref: "§3 User"
story_ref: US-001
entity: User
operations: [create]
---

## Descripción

Implementar el modelo User en Prisma y generar la migración inicial.

## Código Esperado

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  role      String   @default("user")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Verificación

```bash
npx prisma migrate dev --name add_user
```

**Output esperado:** "Your database is now in sync with your schema"

## Reglas de Inferencia

- [crud-auto] Esta entidad requiere CRUD completo. Las siguientes tareas T-002 a T-006 se generan automáticamente.
- [soft-delete] Si el campo `deletedAt` existe, usa soft-delete en DELETE.
- [pagination] El endpoint LIST debe usar cursor pagination con pageSize=20.
```
```

### 4.2 Tipos de `change_type`

| Tipo | Significado | Ejemplo |
|------|-------------|---------|
| `create` | Crear archivo nuevo | Modelo Prisma, componente React |
| `modify` | Editar archivo existente | Agregar campo a un formulario |
| `delete` | Eliminar archivo | Borrar componente obsoleto |
| `append` | Añadir al final de archivo | Nueva ruta en router |
| `insert` | Insertar en posición específica | Campo después de línea N |
| `replace` | Reemplazar bloque existente | Refactorizar función |
| `run` | Ejecutar comando | Migración, instalar paquete |
| `configure` | Cambiar configuración | tsconfig, Dockerfile |

### 4.3 Campos del front-matter

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | string | Sí | Identificador único de tarea (T-NNN) |
| `title` | string | Sí | Título breve y accionable |
| `change_type` | enum | Sí | Tipo de cambio (ver tabla arriba) |
| `target_files` | string[] | Sí | Lista de archivos afectados |
| `language` | string | No | Lenguaje del cambio (typescript, prisma, sql, etc.) |
| `dependencies` | string[] | No | IDs de tareas que deben completarse antes |
| `parallel` | boolean | No | Si puede ejecutarse en paralelo con otras del mismo checkpoint |
| `estimated_minutes` | number | No | Estimación de tiempo |
| `mdd_ref` | string | No | Referencia al MDD |
| `story_ref` | string | No | Referencia a User Story |
| `entity` | string | No | Entidad afectada (para inferencia CRUD) |
| `operations` | string[] | No | Operaciones CRUD implicadas |
| `insert_after` | string | No | Para `insert`: identificador de anclaje (nombre de campo, función, etc.) |
| `test_command` | string | No | Comando para verificar la tarea |
| `test_expected` | string | No | Output esperado del test |

### 4.4 Bloques especiales en el cuerpo

#### 4.4.1 Código esperado

```markdown
## Código Esperado

```typescript
// Si change_type == create: el código completo del archivo
// Si change_type == modify: el diff o el bloque a modificar
// Si change_type == insert: el bloque a insertar con contexto
```
```

#### 4.4.2 Reglas de inferencia

```markdown
## Reglas de Inferencia

- [crud-auto] Esta entidad requiere CRUD completo. Si el agente ve esta regla, debe inferir que faltan las tareas de controller, service, DTO y frontend.
- [soft-delete] El DELETE no debe eliminar físicamente; usar deletedAt.
- [pagination-default] Todos los endpoints LIST usan cursor pagination a menos que el MDD diga offset.
- [rbac-check] Todos los endpoints mutantes requieren verificación de rol.
- [zod-validation] Todos los DTOs deben validar con Zod, no con class-validator.
```

#### 4.4.3 Contexto de tipos

```markdown
## Contexto de Tipos

```json
{
  "CreateUserDto": {
    "email": "string (email)",
    "role": "UserRole = 'user' | 'admin' | 'moderator'",
    "password": "string (min 8)"
  },
  "UserResponse": {
    "id": "UUID",
    "email": "string",
    "role": "UserRole",
    "createdAt": "ISO 8601"
  }
}
```
```

---

## 5. Patrones de Inferencia Declarativa

### 5.1 Reglas `[crud-auto]`

Cuando una entidad tiene `operations: ['crud']`, el agente DEBE inferir y crear AUTOMÁTICAMENTE estas tareas si no existen explícitamente:

```
Para entidad X:
├── Backend (NestJS/Prisma)
│   ├── T-NN0: Modelo Prisma para X
│   ├── T-NN1: DTO CreateXDto (Zod schema)
│   ├── T-NN2: DTO UpdateXDto (Zod schema, partial)
│   ├── T-NN3: DTO XResponse (serialización)
│   ├── T-NN4: XService (create, findOne, findAll, update, remove)
│   ├── T-NN5: XController (POST, GET, GET/:id, PATCH, DELETE)
│   ├── T-NN6: Tests unitarios para XService
│   └── T-NN7: Tests e2e para XController
├── Frontend (React)
│   ├── T-NN8: Hook useX() (CRUD via React Query)
│   ├── T-NN9: Componente XList (DataTable + pagination + search)
│   ├── T-NN10: Componente XDetail (tabs: view/edit)
│   └── T-NN11: Componente XForm (react-hook-form + Zod resolver)
└── Shared
    └── T-NN12: Tipos TypeScript en shared-types
```

**Regla de oro:** Si el MDD define una entidad y no dice "sin CRUD" o "solo lectura", asumir CRUD completo.

### 5.2 Reglas `[soft-delete-auto]`

Si una entidad tiene campo `deletedAt` (nullable timestamp):

- El endpoint DELETE hace `UPDATE ... SET deletedAt = now()`
- El endpoint GET/:id excluye `WHERE deletedAt IS NOT NULL` (a menos que `?includeDeleted=true`)
- El endpoint LIST filtra `WHERE deletedAt IS NULL` por defecto
- Añadir endpoint `POST /api/X/:id/restore` para restaurar

### 5.3 Reglas `[pagination-auto]`

Si un endpoint es tipo LIST y el MDD no especifica otra cosa:

- Usar cursor pagination (para escalabilidad)
- Page size por defecto: 20
- Campos sortable: `createdAt`, `id` + cualquier campo marcado como `sortable: true` en types.json
- Parámetros de query: `cursor`, `limit`, `sort`, `order`

### 5.4 Reglas `[search-auto]`

Si una entidad tiene campos marcados como `searchable: true`:

- El endpoint LIST acepta `?q=` para búsqueda fulltext
- Los campos `email`, `name`, `title` son searchable por defecto
- Usar debounce de 300ms en el frontend

### 5.5 Reglas `[audit-auto]`

Si una entidad tiene flags `auditable`:

- Campos automáticos: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
- Middleware de Prisma o hook de TypeORM para poblar automáticamente
- No exigir estos campos en el DTO de create/update

### 5.6 Reglas `[rbac-auto]`

Si el MDD menciona roles/permisos:

- Todos los endpoints POST/PATCH/DELETE requieren `@Roles()` o `@Permissions()`
- El endpoint GET/:id permite `self` (el dueño puede ver su propio recurso)
- El endpoint GET / lista permite `admin` o `owner`

### 5.7 Reglas `[frontend-auto]`

Por cada entidad con CRUD:

- Si hay panel admin: crear página en `/admin/X`
- Si es recurso público: crear página en `/X` o `/:slug`
- Si es recurso del usuario: crear en `/dashboard/X`
- Formularios: react-hook-form + zod resolver
- Tablas: DataTable con sorting, filtering, pagination
- Estados: loading, empty, error, success

### 5.8 Reglas `[zod-auto]`

Para cada campo del modelo:

```
UUID → z.string().uuid()
EMAIL → z.string().email()
ENUM → z.enum([...values])
STRING → z.string().min(1).max(255)
TEXT → z.string().min(1)
INT → z.number().int()
BIGINT → z.bigint() o z.coerce.bigint()
FLOAT/DECIMAL → z.number()
BOOLEAN → z.boolean()
TIMESTAMP → z.date() o z.string().datetime()
JSON → z.record(z.unknown())
RELATION → z.string().uuid() (para FK)
```

---

## 6. Pipeline de Generación Optimizado

### 6.1 LangGraph MDD (modificado)

```
START → Clarifier (§1) → Data Architect (§3) → API Architect (§4)
  → Flow Architect (§5) → Security (§6) → Integration (§7)
  → Formatter → LLM Formatter
  → Derived Spec Generator (types.json + operations.json)
  → Diagram Injector → Cross Consistency → Auditor (score 0-100)
  → Task Generator (tasks.md + tasks.json)
  → Task Auditor → Prepare Output → Graph Populator → END
```

### 6.2 Nuevos nodos

#### 6.2.1 Data Architect Node (antes Software Architect — solo §3)

**Responsabilidad:** Generar MDD §3 (Modelo de Datos) con estructura enriquecida.

**Prompt especializado:**
- Enfocado EXCLUSIVAMENTE en modelos de datos
- Genera SQL + types.json simultáneamente
- Valida que cada entidad tenga: PK, createdAt, updatedAt (si auditable), deletedAt (si soft-delete)
- Marca operaciones CRUD por entidad

#### 6.2.2 API Architect Node (antes parte de Software Architect — solo §4)

**Responsabilidad:** Generar MDD §4 (Contratos de API) con operaciones.json.

**Prompt especializado:**
- Lee types.json generado por Data Architect
- Genera rutas automáticas basadas en operations.json
- No inventa rutas que no correspondan a entidades existentes
- Valida que cada endpoint tenga: método, ruta, auth, request DTO, response DTO, errores

#### 6.2.3 Derived Spec Generator Node (NUEVO)

**Input:** MDD completo + types.json + operations.json
**Output:**
- `types.json` (refinado)
- `operations.json` (refinado)
- `interaction-spec.md` (fusión de HU + Flujos)

**Heurísticas:**
- Si entidad tiene `deletedAt` → añadir flag `soft_delete` a operations.json
- Si entidad tiene `role` o `permissions` → añadir flag `rbac` a operations.json
- Si §1 menciona "panel admin" → añadir flag `admin_ui` a operations.json
- Si §2 menciona "React" + "Next.js" → añadir flag `ssr` a operations.json

#### 6.2.4 Task Generator Node (modificado)

**Input:** MDD + types.json + operations.json + interaction-spec.md
**Output:** `tasks.md` (formato ejecutable) + `tasks.json` (parseado)

**Heurísticas:**
- Por cada entidad con CRUD: generar las 12 tareas del patrón [crud-auto]
- Por cada endpoint en operations.json: generar tarea de controller + tests
- Por cada página en operations.json.frontend: generar tarea de componente
- Respetar dependencias: modelo antes que service, service antes que controller, controller antes que frontend
- Marcar paralelizables: frontend y backend pueden correr en paralelo si el contrato está definido

#### 6.2.5 Task Auditor Node (NUEVO)

**Input:** tasks.json + operations.json + types.json
**Output:** tasks.json corregido + score

**Validaciones:**
1. Cobertura: ¿Cada entidad con CRUD tiene las 12 tareas? Si no, generar faltantes.
2. Dependencias: ¿Hay ciclos? ¿Hay tareas huérfanas?
3. Archivos: ¿Cada tarea tiene al menos un target_file?
4. Verificación: ¿Las tareas de backend tienen test_command?
5. Trazabilidad: ¿Cada tarea referencia MDD §3?

**Score:**
- 100 puntos base
- -10 por cada entidad CRUD sin cobertura completa
- -5 por cada tarea sin target_file
- -5 por cada tarea sin verification
- -20 por ciclo de dependencias
- Umbral VERDE: >= 90

### 6.3 Cascada de documentos (nuevo orden)

```
Fase 1 (secuencial):
  1. MDD §1-§7 (incluye types.json y operations.json en §3-§4)
  
Fase 2 (paralelo):
  2. Blueprint (usa MDD + operations.json)
  3. Architecture (usa MDD §2 + operations.json)
  4. Spec (usa MDD §1 + interaction-spec)
  5. Data Model (extracto §3, ya listo)
  
Fase 3 (paralelo):
  6. API Contracts (usa operations.json directamente)
  7. Logic Flows (usa operations.json + interaction-spec)
  8. UX/UI Guide (usa operations.json.frontend + types.json)
  9. UI Screens (usa operations.json.frontend)
  
Fase 4 (secuencial):
  10. Tasks (usa TODO: MDD + operations.json + types.json + interaction-spec)
  11. Task Auditor (valida tasks)
  
Fase 5 (paralelo):
  12. Infra (usa MDD §7)
  13. Agent Governance (usa MDD + Blueprint + operations.json)
  14. Quickstart (usa tasks + types.json + operations.json)
```

---

## 7. Fases de Implementación

### FASE 0 — Preparación (4h)

- [ ] **0.1** Backup de producción
- [ ] **0.2** Crear rama `lean-sdd`
- [ ] **0.3** Instalar dependencias nuevas: `yaml-front-matter`, `json-schema-to-zod`
- [ ] **0.4** Crear fixtures de prueba: MDD de ejemplo con types.json y operations.json

### FASE 1 — Schema Prisma (4h)

- [ ] **1.1** Crear tabla `StageDerivedSpec` para almacenar types.json y operations.json
  ```prisma
  model StageDerivedSpec {
    id              String   @id @default(uuid())
    stageId         String   @unique
    stage           Stage    @relation(fields: [stageId], references: [id], onDelete: Cascade)
    typesJson       Json     // types.json estructurado
    operationsJson  Json     // operations.json estructurado
    tasksJson       Json     // tasks.json parseado
    derivedAt       DateTime @default(now())
    mddHash         String   // hash del MDD usado para derivar
  }
  ```
- [ ] **1.2** Ejecutar migración
- [ ] **1.3** Añadir índices para queries por stage

### FASE 2 — Parser de MDD Enriquecido (8h)

- [ ] **2.1** Crear `mdd-types-extractor.ts` — extrae types.json desde markdown §3
- [ ] **2.2** Crear `mdd-operations-extractor.ts` — extrae operations.json desde markdown §1+§3+§4
- [ ] **2.3** Crear `mdd-derived-spec-validator.ts` — valida que types.json y operations.json sean coherentes
- [ ] **2.4** Tests unitarios para extractores con fixtures reales

### FASE 3 — Nuevos Nodos LangGraph (16h)

- [ ] **3.1** Crear `mdd-data-architect.node.ts` — reemplaza §3 del Software Architect
- [ ] **3.2** Crear `mdd-api-architect.node.ts` — reemplaza §4 del Software Architect
- [ ] **3.3** Crear `mdd-flow-architect.node.ts` — reemplaza §5 del Software Architect
- [ ] **3.4** Modificar `mdd-software-architect.node.ts` para delegar a nodos especializados
- [ ] **3.5** Crear `derived-spec-generator.node.ts`
- [ ] **3.6** Modificar `mdd-task-generator.node.ts` para usar operations.json
- [ ] **3.7** Crear `task-auditor.node.ts`
- [ ] **3.8** Actualizar grafo en `mdd-graph.ts`

### FASE 4 — Parser de Tasks Ejecutable (8h)

- [ ] **4.1** Modificar `tasks-parse.ts` para soportar YAML front-matter
- [ ] **4.2** Crear `tasks-to-json.ts` — convierte tasks.md a tasks.json
- [ ] **4.3** Crear `tasks-dependency-graph.ts` — detecta ciclos y orden topológico
- [ ] **4.4** Crear `task-verification-runner.ts` — ejecuta test_command y compara expected_output
- [ ] **4.5** Tests unitarios con fixtures

### FASE 5 — Spec-kit Bundle (6h)

- [ ] **5.1** Modificar `spec-kit-bundle.ts` para incluir:
  - `specs/NNN-slug/types.json`
  - `specs/NNN-slug/operations.json`
  - `specs/NNN-slug/tasks.json`
  - `.cursorrules` (derivado de §2)
- [ ] **5.2** Crear `.cursorrules` generator desde MDD §2
- [ ] **5.3** Modificar `buildQuickstart` para usar operations.json (no regex)
- [ ] **5.4** Tests de integración

### FASE 6 — Prompts Actualizados (12h)

- [ ] **6.1** Crear `data-architect-prompt.md` (especializado §3)
- [ ] **6.2** Crear `api-architect-prompt.md` (especializado §4)
- [ ] **6.3** Crear `flow-architect-prompt.md` (especializado §5)
- [ ] **6.4** Modificar `tasks-prompt.md` para generar formato ejecutable
- [ ] **6.5** Añadir few-shot de implementación en `tasks-prompt.md` (ejemplos de código real)
- [ ] **6.6** Crear `task-auditor-prompt.md`
- [ ] **6.7** Actualizar `master-prompt.md` para reflejar nuevos nodos

### FASE 7 — Frontend Workshop (8h)

- [ ] **7.1** Nueva pestaña "Tipos" que muestra types.json renderizado
- [ ] **7.2** Nueva pestaña "Operaciones" que muestra operations.json como tabla
- [ ] **7.3** Visualización de grapho de dependencias de tasks
- [ ] **7.4** Botón "Ejecutar verificación" por tarea
- [ ] **7.5** Exportar spec-kit v2 con los nuevos archivos

### FASE 8 — Tests y QA (8h)

- [ ] **8.1** Tests de regresión de todo el pipeline
- [ ] **8.2** Tests de integración end-to-end: crear proyecto → MDD → tasks → spec-kit
- [ ] **8.3** Validar que tasks.json generado tenga 90%+ de cobertura CRUD
- [ ] **8.4** Benchmark: tiempo de cascada completa (meta: < 5 min para HIGH)

### FASE 9 — Migración y Documentación (4h)

- [ ] **9.1** Script de migración de datos históricos
- [ ] **9.2** Guía de usuario para nuevo formato
- [ ] **9.3** Documentación técnica para developers
- [ ] **9.4** Release notes

---

## 8. Plan de Cambios en Prompts

### 8.1 Principios de prompt engineering para inferencia

1. **Un prompt = una responsabilidad** — No mezclar "genera SQL + genera API + genera tests" en un solo prompt
2. **Output estructurado > prosa** — Forzar YAML front-matter o JSON, no texto libre
3. **Few-shot con código real** — Incluir ejemplos completos de archivos, no pseudocódigo
4. **Señales de control explícitas** — `[crud-auto]`, `[soft-delete]` en lugar de "considera soft-delete"
5. **Validación inline** — El prompt debe incluir "antes de responder, verifica que..."

### 8.2 Estructura de todo prompt de generación

```markdown
# Rol
[Especialización específica, no genérica]

# Contexto de entrada
[YAML con inputs estructurados]
```yaml
mdd_section: "..."
types_json: { ... }
operations_json: { ... }
previous_output: "..." (para iteración)
```

# Instrucciones
1. [Paso concreto]
2. [Paso concreto]
3. [Paso concreto]

# Formato de salida (INVIOLABLE)
[YAML front-matter obligatorio + cuerpo markdown]

# Ejemplo (few-shot)
[Ejemplo completo de input → output]

# Auto-validación
Antes de responder, verifica:
- [ ] ¿Cada entidad tiene PK, createdAt, updatedAt?
- [ ] ¿Los nombres de campo coinciden con types.json?
- [ ] ¿Los endpoints cubren todas las operaciones de operations.json?
- [ ] ¿Hay al menos un test por endpoint mutante?
```

### 8.3 Few-shot para tasks

Cada prompt de tasks debe incluir 2-3 ejemplos completos:

```markdown
## Ejemplo 1: Crear modelo Prisma

Input:
```yaml
entity: User
operations: [create, read, update, delete, list]
fields:
  - name: id, type: UUID
  - name: email, type: EMAIL
```

Output:
```markdown
---
id: T-001
title: Create User model in Prisma
change_type: create
target_files: [packages/database/schema.prisma]
---

## Código
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```
```

## Ejemplo 2: Crear endpoint REST

[...]
```

---

## 9. Checklist de Validación

### 9.1 Métricas de éxito

| Métrica | Target | Cómo medir |
|---------|--------|------------|
| Cobertura CRUD | 100% | Tasks.json tiene tareas para create/read/update/delete/list de cada entidad |
| Cobertura de tipos | 100% | types.json tiene todos los campos del MDD §3 |
| Tareas con archivo | >= 95% | % de tareas con target_files no vacío |
| Tareas con verificación | >= 90% | % de tareas con test_command |
| Tareas sin dependencias cíclicas | 0% | tasks-dependency-graph.ts reporta 0 ciclos |
| Tiempo de cascada HIGH | < 5 min | Benchmark de staging |
| Precisión de inferencia | 85-90% | Validación manual de 10 proyectos de prueba |

### 9.2 Criterios de aceptación

- [ ] Un agente Cursor puede leer tasks.md y producir código compilable sin preguntar
- [ ] Un agente Claude puede leer tasks.md + types.json y producir interfaces TypeScript correctas
- [ ] El spec-kit exportado incluye todos los archivos necesarios para implementación
- [ ] El Task Auditor rechaza tareas incompletas (score < 90)
- [ ] La cascada de documentos completa toma < 5 minutos para un proyecto HIGH
- [ ] Los datos históricos se migran sin pérdida de información

---

> **Nota final:** Este plan es un documento vivo. Actualizarlo según se descubran nuevas brechas durante la implementación.
