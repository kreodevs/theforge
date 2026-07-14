# Lean SDD: Guía de Integración con TheForge Existente

> **Rama:** `lean-sdd`  
> **Propósito:** Documentar cómo conectar los nuevos extractores, parsers y prompts al pipeline LangGraph ya existente de TheForge.

---

## 1. Resumen de Artefactos Nuevos

| Artefacto | Ruta | Rol en el nuevo pipeline |
|-----------|------|--------------------------|
| `types-extractor.ts` | `engine/mdd-extractors/` | Extrae types.json desde MDD §3 |
| `operations-extractor.ts` | `engine/mdd-extractors/` | Extrae operations.json desde §4 |
| `tasks-parser-v2.ts` | `engine/task-v2/` | Parsea tasks.md formato ejecutable |
| `inference-engine.ts` | `engine/task-v2/` | Genera tareas inferidas desde operations.json |
| `task-auditor.ts` | `engine/task-v2/` | Valida calidad de tasks (score 0-100) |
| `data-architect-prompt.md` | `ai/prompts/` | Prompt especializado §3 |
| `api-architect-prompt.md` | `ai/prompts/` | Prompt especializado §4 |
| `flow-architect-prompt.md` | `ai/prompts/` | Prompt especializado §5 |
| `spec-kit-bundle-v2.ts` | `modules/projects/` | Exporta ZIP con types.json + operations.json |
| `StageDerivedSpec` | `database/schema.prisma` | Tabla para cachear specs estructurados |
| `.cursorrules` generator | `spec-kit-bundle-v2.ts` | Reglas de estilo para agentes implementadores |

---

## 2. Pipeline de Generación Actual vs Nuevo

### Pipeline ACTUAL (antes de lean-sdd)

```
Usuario → Chat → MDD (§1-§7) → LangGraph → [Software Architect] → §2-§5
                                              → [Security] → §6
                                              → [Integration] → §7
                                              → [Auditor] → score
                                              → [Tasks] → tasks.md (libre)
                                              → [Spec] → spec.md
                                              → [Blueprint] → plan.md
```

**Problema:** Software Architect genera TODO (§2-§5) en un solo prompt. Luego tasks se generan desde markdown libre.

### Pipeline NUEVO (objetivo lean-sdd)

```
Usuario → Chat → MDD (§1) → [Clarifier]
                                      ↓
                        [Data Architect] → §3 + types.json
                                      ↓
                        [API Architect] → §4 + operations.json
                                      ↓
                        [Flow Architect] → §5 + inference-rules.yaml
                                      ↓
                        [Security] → §6
                                      ↓
                        [Integration] → §7
                                      ↓
                        [Cross Consistency] → valida §3 vs §4 vs types.json
                                      ↓
                        [Derived Spec Generator] → consolida types + operations
                                      ↓
                        [Auditor MDD] → score 0-100
                                      ↓
                        [Task Generator v2] → tasks.md estructurado + tasks.json
                                      ↓
                        [Inference Engine] → completa tareas faltantes (CRUD auto)
                                      ↓
                        [Task Auditor] → score tasks >= 90
                                      ↓
                        [Spec-kit Bundle v2] → ZIP con types.json + operations.json + .cursorrules
```

**Beneficio:** Cada agente tiene una sola responsabilidad, output estructurado (JSON/YAML), y el sistema puede validar automáticamente consistencia.

---

## 3. Puntos de Integración por Módulo

### 3.1 LangGraph — Grafo MDD (`mdd-graph.ts`)

**Cambio:** Dividir el nodo `software_architect` en 3 nodos especializados.

#### Paso A: Extraer §3 independientemente

En `mdd-graph.ts`, reemplazar:
```typescript
// ANTES:
.addNode("software_architect", softwareArchitectNode)

// DESPUÉS:
.addNode("data_architect", dataArchitectNode)
.addNode("api_architect", apiArchitectNode)
.addNode("flow_architect", flowArchitectNode)
```

#### Paso B: Encadenar con flujo de datos

```typescript
// Nuevo flujo para §3 → §4 → §5
.addEdge("clarifier", "data_architect")
.addEdge("data_architect", "api_architect")
.addEdge("api_architect", "flow_architect")
.addEdge("flow_architect", "security_integration")
```

**Nota:** `data_architect` ahora genera `types_json` como parte del state del grafo.

#### Paso C: Nuevo nodo `derived_spec_generator`

```typescript
.addNode("derived_spec_generator", derivedSpecGeneratorNode)
.addEdge("cross_consistency", "derived_spec_generator")
.addEdge("derived_spec_generator", "auditor")
```

Este nodo:
1. Lee `mddDraft` (§3 y §4)
2. Ejecuta `extractTypesFromMddSection3(section3)`
3. Ejecuta `extractOperationsFromMdd(section3, section4, typesJson)`
4. Guarda `typesJson` y `operationsJson` en el estado del grafo
5. Puebla `stage.derivedSpec` en la base de datos (modelo `StageDerivedSpec`)

#### Paso D: Nuevo nodo `task_generator_v2`

```typescript
.addNode("task_generator_v2", taskGeneratorV2Node)
.addEdge("auditor", "task_generator_v2")
```

Este nodo:
1. Lee `typesJson` y `operationsJson` del estado
2. Genera tasks.md en formato v2 (YAML front-matter)
3. Parsea con `parseTasksV2()` → tasks.json
4. Ejecuta `inferTasks()` para completar tareas faltantes
5. Guarda ambos en `stage.tasksContent` y `stage.tasksJson`

#### Paso E: Nuevo nodo `task_auditor`

```typescript
.addNode("task_auditor", taskAuditorNode)
.addEdge("task_generator_v2", "task_auditor")
```

Si score < 90, re-enruta a `task_generator_v2` con feedback de gaps.

---

### 3.2 Servicio de Proyectos (`projects.service.ts`)

**Cambio:** Reemplazar llamadas a `generateTasks` y `generateSpec` para usar los nuevos extractores.

#### Añadir métodos al service

```typescript
// NUEVO: generar derived spec desde MDD
async generateDerivedSpec(projectId: string, stageId: string) {
  const stage = await this.prisma.stage.findUnique({ where: { id: stageId } });
  if (!stage?.mddContent) throw new Error("MDD requerido");

  const s3 = extractMddSection(stage.mddContent, 3);
  const s4 = extractMddSection(stage.mddContent, 4);

  const typesJson = extractTypesFromMddSection3(s3);
  const operationsJson = extractOperationsFromMdd(s3, s4, typesJson);

  await this.prisma.stageDerivedSpec.upsert({
    where: { stageId },
    create: {
      stageId,
      typesJson: typesJson as any,
      operationsJson: operationsJson as any,
      mddHash: hashString(stage.mddContent),
    },
    update: {
      typesJson: typesJson as any,
      operationsJson: operationsJson as any,
      mddHash: hashString(stage.mddContent),
    },
  });

  return { typesJson, operationsJson };
}

// NUEVO: regenerar tasks v2 si derived spec cambió
async generateTasksV2(projectId: string, stageId: string) {
  const derived = await this.prisma.stageDerivedSpec.findUnique({ where: { stageId } });
  if (!derived) await this.generateDerivedSpec(projectId, stageId);

  // Obtener derived actualizado
  const fresh = await this.prisma.stageDerivedSpec.findUnique({ where: { stageId } });
  const types = fresh!.typesJson as any;
  const operations = fresh!.operationsJson as any;

  // Generar tasks con LLM + inference engine
  const tasksMarkdown = await this.ai.generateTasksV2({
    mddContent: (await this.prisma.stage.findUnique({ where: { id: stageId } }))!.mddContent!,
    typesJson: types,
    operationsJson: operations,
  });

  // Parsear y enriquecer
  const parsed = parseTasksV2(tasksMarkdown);
  const inferred = inferTasks({
    typesJson: types,
    operationsJson: operations,
    existingTasks: parsed.tasks,
    stage: stageId,
  });

  // Combinar y auditar
  const allTasks = [...parsed.tasks, ...inferred.inferredTasks.map((i) => i.task)];
  const audit = auditTasks({ ...parsed, tasks: allTasks });

  return {
    tasksMarkdown,
    tasksJson: JSON.stringify({ tasks: allTasks, audit }),
    auditScore: audit.score,
  };
}
```

---

### 3.3 AI Service (`ai.service.ts`)

**Cambio:** Añadir `generateTasksV2` y `generateDerivedSpec` como métodos del AI service.

```typescript
// En ai.service.ts
async generateTasksV2(input: {
  mddContent: string;
  typesJson: object;
  operationsJson: object;
}): Promise<string> {
  const prompt = this.buildTasksV2Prompt(input);
  return this.llm.generate(prompt, { temperature: 0.2 });
}

private buildTasksV2Prompt(input: typeof this.generateTasksV2 extends infer T ? T extends (...args: infer A) => any ? A[0] : never : never): string {
  return `
Misión: Generar tasks.md en formato ejecutable (v2) para agentes de código.

## Contexto estructurado (no adivinar)
- types_json: ${JSON.stringify(input.typesJson, null, 2)}
- operations_json: ${JSON.stringify(input.operationsJson, null, 2)}

## Instrucciones
1. Generar tasks.md con formato YAML front-matter por tarea.
2. Cada tarea debe tener: id, title, change_type, target_files.
3. Incluir Código Esperado para las tareas críticas.
4. Añadir bloque de Verificación con test_command y expected_output.
5. Usar reglas de inferencia: [crud-auto], [soft-delete], [pagination-default], [zod-auto].

## Ejemplo de formato
${this.loadTaskExample()}

## Restricciones
- Solo generar tareas trazables a entities del types_json.
- NO inventar endpoints que no existan en operations_json.
- Incluir al menos 1 test_command por entidad principal.
`;
}
```

---

### 3.4 Workshop UI (`WorkshopView.tsx`)

**Cambio:** Añadir nuevas pestañas/visualizaciones.

#### Nueva pestaña: "Derived Spec" (o incluir en panel existente)

En la columna de documentos, añadir:
- **Tipos**: muestra `types.json` como tabla interactiva (entidades, campos, Zod schemas)
- **Operaciones**: muestra `operations.json` como diagrama de endpoints

#### Integración con `useWorkshopStore`

```typescript
// Añadir al store
interface WorkshopState {
  // ...existente
  generateDerivedSpec: (projectId: string, stageId: string) => Promise<void>;
  derivedSpec?: {
    typesJson: object;
    operationsJson: object;
    tasksJson: object;
    auditScore: number;
  };
}
```

---

### 3.5 Spec-Kit Export (`sdd-integration.service.ts`)

**Cambio:** Usar `buildSpecKitBundleFilesV2` en lugar de v1.

**Estado:** ✅ Implementado en `sdd-integration.service.ts`.
```typescript
// buildBundleForProject ahora usa buildSpecKitBundleFilesV2
import { buildSpecKitBundleFilesV2, type SpecKitBundleInputV2 } from "./spec-kit-bundle-v2.js";

const derived = stage?.derivedSpec;
return buildSpecKitBundleFilesV2({
  // ...legacy fields...
  typesJsonContent: derived?.typesJson ? JSON.stringify(derived.typesJson) : null,
  operationsJsonContent: derived?.operationsJson ? JSON.stringify(derived.operationsJson) : null,
  tasksJsonContent: derived?.tasksJson ? JSON.stringify(derived.tasksJson) : null,
} as SpecKitBundleInputV2);
```

### 3.4 Workshop UI (`WorkshopView.tsx`, `DashboardSidebar.tsx`)

**Cambio:** Añadir pestañas "Tipos" y "Operaciones" que renderizan `types.json` y `operations.json`.

**Estado:** ✅ Implementado.

| Panel | Componente | Fuente |
|-------|----------|--------|
| Tipos | `JsonDocPanel` | `stage.derivedSpec.typesJson` |
| Operaciones | `JsonDocPanel` | `stage.derivedSpec.operationsJson` |

Cambios realizados:
- `workshopStore.ts`: añadidos `typesContent` y `operationsContent`
- `workshopDocNav.ts`: añadidos nav items `types` y `operations`
- `complexityTabs.ts`: añadidas pestañas al union type
- `DashboardSidebar.tsx`: pasa `typesContent` y `operationsContent` al nav context
- `WorkshopView.tsx`: render condicional con `<JsonDocPanel />`
- `JsonDocPanel.tsx`: nuevo componente para visualizar JSON formateado con copy-to-clipboard

---

---

## 4. Secuencia de Migración de Datos

### Fase 1: Schema (ya hecho)
1. ✅ Añadir `StageDerivedSpec` (migración aditiva)
2. ✅ Añadir relación inversa en `Stage`

### Fase 2: Extractores (ya hecho)
1. ✅ Implementar `types-extractor.ts`
2. ✅ Implementar `operations-extractor.ts`
3. ✅ Tests de extractores

### Fase 3: Parsers (ya hecho)
1. ✅ Implementar `tasks-parser-v2.ts`
2. ✅ Implementar `inference-engine.ts`
3. ✅ Implementar `task-auditor.ts`

### Fase 4: Prompts (ya hecho)
1. ✅ `data-architect-prompt.md`
2. ✅ `api-architect-prompt.md`
3. ✅ `flow-architect-prompt.md`

### Fase 5: Integración LangGraph + Frontend + Backend (✅ COMPLETADA)
1. ✅ Modificar `mdd-graph.ts` para añadir nodos especializados (`derived_spec_generator`, `task_generator_v2`, `task_auditor`)
2. ✅ Modificar `ai-analysis.service.ts` para persistir `derivedSpec` tras cada pipeline MDD
3. ✅ Modificar `projects.service.ts` (`assertProjectAccess`) para incluir `derivedSpec` en query de proyecto
4. ✅ Modificar UI (`WorkshopView.tsx`, `DashboardSidebar.tsx`, `JsonDocPanel.tsx`) para mostrar tipos/operaciones

### Fase 6: Spec-kit v2 (✅ COMPLETADA)
1. ✅ Integrar `buildSpecKitBundleFilesV2` en `sdd-integration.service.ts`
2. ✅ Añadir generador de `.cursorrules` en `spec-kit-bundle-v2.ts`

---

## 5. Checklist de Go-Live

Antes de mergear `lean-sdd` a `master`:

- [ ] Todos los tests de extractores pasan (`pnpm test`)
- [ ] Todos los tests de parser v2 pasan
- [ ] Task Auditor score >= 90 en fixtures de ejemplo
- [ ] La cascada de documentos completa genera types.json y operations.json sin errores
- [ ] El spec-kit exportado incluye types.json, operations.json, .cursorrules
- [ ] Proyectos existentes en BD no se rompen (backwards-compatible)
- [ ] Workshop UI no crashea al mostrar nuevas pestañas
- [ ] Documentación actualizada (`LEAN-SDD-*`)

---

> **Nota:** Los puntos 1-4 de esta guía (artefactos) ya están implementados en la rama `lean-sdd`. Los puntos 5 (integración real con LangGraph) requieren modificaciones a nodos existentes y deben probarse en staging antes de producción.
