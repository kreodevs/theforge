# Diseño: Etapas del Workshop como Cambios en Flujo Legacy

## Visión

Cada **etapa (stage)** del Workshop representa un **cambio específico** sobre el código existente.
- **Stage 1 (inicial)**: Describe el sistema completo (MDD inicial) — es la "foto" del producto desde Ariadne.
- **Stage 2+**: Cada etapa nueva es un cambio que:
  - Se analiza con Ariadne (qué código impacta)
  - Tiene su propio BRD (reglas de negocio del cambio)
  - Tiene su propio To-Be (estado deseado post-cambio)
  - Tiene su propio MDD de cambio
  - Todos los documentos (SPEC, Arquitectura, Blueprint, API, Tasks, etc.) se generan **solo** para el alcance de esa etapa
  - Las relaciones entre etapas se almacenan en **FalkorDB** como grafo de dependencias

## Arquitectura Actual (a modificar)

```
Project
├── legacyFlowState (un solo objeto) ← el problema
│   ├── description
│   ├── filesToModify
│   ├── questions/answers
│   ├── codebaseDoc
│   └── lastDeliverablesDebug
├── Stage 1 (Workshop)
│   ├── brdContent, toBeManualContent, asIsManualContent
│   ├── mddContent
│   └── specContent, architectureContent, ...
└── Stage 2 (Workshop)
    ├── brdContent, toBeManualContent
    ├── mddContent
    └── ...
```

Problema: **legacyFlowState es único, pero cada cambio necesita su propio estado.**

## Arquitectura Propuesta

```
Project
├── Stage 1 (inicial - describe el sistema)
│   ├── kind: "BASELINE"
│   ├── legacyChangeState ← NUEVO: estado de cambio propio de la etapa
│   │   ├── description: "" (vacío = inicial)
│   │   ├── codebaseDoc: "MDD inicial de Ariadne"
│   │   ├── filesToModify: [] (vacío = todo el sistema)
│   │   ├── questions: []
│   │   ├── answers: {}
│   │   ├── ariadneMddGraphNodes: [...] ← NUEVO: nodos del grafo Falkor que describe esta etapa
│   │   └── theforgeProjectId: "uuid"
│   ├── brdContent, toBeManualContent, asIsManualContent
│   └── mddContent (MDD inicial del sistema)
│
├── Stage 2 (cambio: "agregar módulo X")
│   ├── kind: "CHANGE"
│   ├── parentStageId: "stage-1-id" ← cascada
│   ├── legacyChangeState
│   │   ├── description: "Agregar módulo de pagos..."
│   │   ├── codebaseDoc: "..." (hereda + merge de stage anterior)
│   │   ├── filesToModify: ["src/modules/pagos/..."]
│   │   ├── questions: ["¿Usarás tarjetas o transferencia?"]
│   │   ├── answers: {"0": "Ambos"}
│   │   ├── ariadneMddGraphNodes: [...] ← NUEVOS nodos que este cambio agrega/modifica
│   │   └── theforgeProjectId: "uuid"
│   ├── brdContent (BRD del cambio: nuevas reglas de pago)
│   ├── toBeManualContent (To-Be del cambio)
│   └── mddContent (MDD de cambio, incremental sobre Stage 1)
│
└── FalkorDB (grafo de dependencias entre etapas)
    ├── (Stage1) ──[PARENT_OF]──> (Stage2)
    ├── (Stage2) ──[AFFECTS]──> (Entity: ModuloPagos)
    ├── (Stage2) ──[AFFECTS]──> (API: POST /pagos)
    └── ...
```

## Componentes Nuevos

### 1. `legacyChangeState` (campo JSON en `Stage`)

Reemplaza `Project.legacyFlowState`. Cada etapa tiene el suyo:

```typescript
// En Prisma Stage model
legacyChangeState?: JsonValue // opcional, solo para etapas legacy

// TypeScript
interface LegacyChangeState {
  description: string;
  codebaseDoc?: string;
  filesToModify?: TheForgeFileToModify[] | string[];
  questions?: string[];
  answers?: Record<string, string>;
  theforgeProjectId?: string;
  ariadneMddGraphNodes?: AriadneGraphNodeRef[];
  ariadneCatalogCache?: string; // catálogo MCP cacheado
  changeBaselineStageId?: string; // etapa base (desde dónde se bifurca)
}
```

### 2. Grafo de dependencias en FalkorDB

```cypher
// Por cada etapa de cambio:
MERGE (s:LegacyStage {stageId: $stageId, projectId: $projectId})
SET s.description = $description, s.ordinal = $ordinal

// Relación con etapa padre (cascada):
MATCH (parent:LegacyStage {stageId: $parentStageId})
MERGE (s)-[:DERIVED_FROM]->(parent)

// Nodos del SDD que este cambio afecta:
MATCH (entity:DB_Entity {id: $entityId})
MERGE (s)-[:AFFECTS]->(entity)

// Nodos del SDD que este cambio CREA:
MERGE (newEntity:DB_Entity {id: $newId, name: $name, stageId: $stageId})
MERGE (s)-[:CREATES]->(newEntity)
```

### 3. Pipeline de generación por etapa

Cuando el usuario genera documentos para Stage N:

```typescript
async generateDeliverablesForStage(stageId: string) {
  // 1. Obtener el cambio de esta etapa
  const change = stage.legacyChangeState;
  
  // 2. Si tiene parentStageId, obtener el MDD base + contexto de etapas anteriores
  const baselineMdd = change.changeBaselineStageId
    ? await getStageMdd(change.changeBaselineStageId)
    : null;
  
  // 3. Construir prompt con:
  //    - MDD base (etapa anterior o inicial)
  //    - BRD/To-Be de esta etapa
  //    - Contexto Ariadne (archivos a modificar)
  //    - Nodos Falkor que esta etapa afecta
  
  // 4. Generar documentos SÓLO para el alcance del cambio
  //    (no redescribir todo el sistema)
}
```

## UX del Workshop

### Etapa 1 (Línea Base)

```
┌─────────────────────────────────────────────┐
│  Etapa 1: Línea Base (OralTrack)             │
│                                              │
│  [✅ Codebase Doc generado]                  │
│  [✅ BRD/To-Be de línea base]                │
│  [✅ MDD inicial del sistema]                │
│                                              │
│  Documentos:                                 │
│  ┌─────────────────────────────────────────┐ │
│  │ SPEC, Arquitectura, CU, Blueprint, ...  │ │
│  │ (describen el sistema COMPLETO)         │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  [+ Nueva etapa de cambio]                   │
└─────────────────────────────────────────────┘
```

### Etapa 2+ (Cambio)

```
┌─────────────────────────────────────────────┐
│  Etapa 2: Módulo de Pagos                    │
│  (cambio sobre Etapa 1)                      │
│                                              │
│  [✏️ Descripción del cambio]                 │
│  [✅ Analizado con AriadneSpecs]             │
│  [✅ BRD del cambio]                         │
│  [✅ To-Be del cambio]                       │
│  [✅ MDD de cambio (incremental)]            │
│                                              │
│  Documentos:                                 │
│  ┌─────────────────────────────────────────┐ │
│  │ SPEC, Arquitectura, Blueprint, ...      │ │
│  │ (SOLO lo que toca el cambio)            │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  [+ Nueva etapa de cambio]                   │
└─────────────────────────────────────────────┘
```

## Migración

Para proyectos legacy existentes (OralTrack):
1. Mover `Project.legacyFlowState` → `Stage 1.legacyChangeState`
2. Stage 1 queda como "Línea Base"
3. Si el proyecto ya tiene BRD/To-Be/MDD en Stage 1, se conservan
4. Nuevas etapas se crean con kind: "CHANGE"

## FalkorDB Queries Necesarias

```cypher
// Etapa 1 (inicial): indexar TODO el SDD del proyecto
MATCH (e) WHERE e.projectId = $projectId
OPTIONAL MATCH (e)-[r]-(related)
RETURN e, collect(r), collect(related)

// Etapa 2 (cambio): solo nodos NUEVOS o MODIFICADOS
MATCH (e:DB_Entity)
WHERE e.projectId = $projectId AND e.stageId = $stageId
RETURN e

// Cascada: qué cambió entre Stage 1 y Stage 2
MATCH (old:DB_Entity {stageId: $stage1Id})
MATCH (new:DB_Entity {stageId: $stage2Id})
WHERE old.name = new.name AND old <> new
RETURN old, new, [c in COLLECT({old: old, new: new}) WHERE old.data <> new.data]
```

## Próximos Pasos Técnicos

1. **Prisma**: Agregar `legacyChangeState` (Json) al modelo `Stage`, quitar `legacyFlowState` de `Project`
2. **FalkorDB**: Agregar nodos `LegacyStage` con relaciones `DERIVED_FROM`, `AFFECTS`, `CREATES`
3. **Backend**: 
   - Refactorizar `legacy-coordinator.service.ts` para trabajar por stageId
   - `generateMdd(stageId)` usa `stage.legacyChangeState`
   - `start(stageId, description)` escribe en `stage.legacyChangeState`
   - `answer(stageId, answers)` escribe en `stage.legacyChangeState`
   - El staged discovery agent acepta `baselineMdd` como contexto
4. **Frontend**:
   - Cada etapa del Workshop legacy muestra su propio panel de cambio
   - Botón "+ Nueva etapa de cambio" en el panel de etapas
   - Al crear una etapa, se clona el `legacyChangeState` de la etapa anterior como base
5. **Prompts**: Modificar para generar documentos incrementales (no redescribir todo)

## Riesgos

- **Migración de datos**: Proyectos legacy existentes con `legacyFlowState` poblado
- **FalkorDB tamaño**: Cada etapa puede tener cientos de nodos. Consultas de cascade deben ser eficientes
- **Context window**: Si Stage 1 tiene 40k chars y Stage 2 agrega otros 20k, el prompt total crece. Usar rollup de contexto.
