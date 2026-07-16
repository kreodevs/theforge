# Propuesta de Cambios a TheForge — Basado en Auditoría Microservice Copilot

**Fecha:** 2026-07-16
**Origen:** Auditoría V2 de calidad de documentos (AUDITORIA-V2-DOCS.md)
**Proyecto piloto:** Microservice Copilot (precisionScore: 82, semáforo AMARILLO)

---

## Resumen

La auditoría reveló **6 problemas sistémicos** en TheForge que se repetirán en todo proyecto. Este documento propone cambios concretos, ordenados por impacto, con el archivo affected y la función a modificar.

---

## P0 — Tasks truncadas (bloquea implementación)

**Síntoma:** Las Fases 4-6 del tasks.json están truncadas. T-34 no tiene target_files ni verification.

**Causa raíz:** El LLM genera ~2,600 palabras de tasks pero el `max_tokens` de salida es 32,768 (~8K palabras). Para proyectos HIGH con 29+ entidades y 50+ endpoints, el output se corta a mitad de un bloque YAML.

**Archivos afectados:**
- `apps/api/src/modules/ai/config/llm-config.ts` — perfil `document`
- `apps/api/src/modules/projects/tasks-generation-pipeline.service.ts` — `buildPlannerContext` y caps de input

### Cambios propuestos

#### 1.1 Aumentar max_tokens del perfil `document` a 65,536

```typescript
// llm-config.ts
document: {
  maxTokens: 65_536,  // era 32_768
  temperature: 0.3,
}
```

**Razón:** Tasks es el documento más largo del cascade. Con 30+ tareas con YAML front-matter completo, 32K tokens es insuficiente para proyectos HIGH.

#### 1.2 Implementar generación de tasks por fases (chunked generation)

En vez de un solo call LLM que genera todo el tasks.md, generar por fase y concatenar:

```typescript
// tasks-generation-pipeline.service.ts — nueva función
async generateTasksByPhase(input: TasksPipelineInput): Promise<string> {
  const phases = this.extractPhasesFromPlan(plan); // Fase 1, 2, 3, ...
  const chunks: string[] = [];
  for (const phase of phases) {
    const phasePrompt = buildPhaseTasksPrompt(phase, mddExcerpt, previousPhases);
    const chunk = await this.ai.generateTasks(phasePrompt, { maxTokens: 16_384 });
    chunks.push(chunk);
  }
  return this.mergeTasksChunks(chunks); // dedup IDs, verify continuity
}
```

**Razón:** Cada fase produce ~1K palabras. Con 6 fases, se necesitan ~6K palabras. Generar por fase reduce el riesgo de truncamiento y permite quality-check incremental.

#### 1.3 Eliminar T-34 huérfana

La task T-34 (`Crear proyecto NestJS con estructura hexagonal`) tiene `targetFiles: []` y `verification: {}`. Esto indica que el planner la creó pero el generador no la pobló.

**Cambio:** En `tasks-generation-structure.util.ts`, añadir validación:

```typescript
// tasks-generation-structure.util.ts — nueva función
function flagOrphanTasks(markdown: string): string[] {
  const gaps: string[] = [];
  // Detectar tareas con target_files vacío o verification vacío
  // y añadirlas como gap para que el repair loop las corrija
  return gaps;
}
```

---

## P1 — Infrastructure sparse (falta CI/CD, AWS, mTLS)

**Síntoma:** Infrastructure tiene solo 821 palabras vs 3,439 de Architecture. Solo cubre Docker Compose local.

**Causa raíz:** `generateInfra()` en `ai.service.ts` **NUNCA llama** a `appendGreenfieldCoverageChecklist()`. El prompt `infra-prompt.md` menciona un checklist de cobertura pero nunca se inyecta.

**Archivos afectados:**
- `apps/api/src/modules/ai/ai.service.ts` — método `generateInfra()` (~línea 1655)
- `apps/api/src/modules/ai/prompts/infra-prompt.md`
- `apps/api/src/modules/engine/conformance.service.ts` — `checkInfraVsMdd()`
- `apps/api/src/modules/engine/sdd-precision-checks.util.ts`

### Cambios propuestos

#### 2.1 Inyectar coverage checklist en generateInfra()

```typescript
// ai.service.ts — generateInfra()
async generateInfra(mddContent, blueprintContent, gapsFeedback, options) {
  let prompt = "Genera el documento de Infraestructura y Despliegue...";
  // ... existing MDD, blueprint, gapsFeedback ...

  // NUEVO: inyectar checklist de cobertura
  const inventory = await this.buildDomainInventory(mddContent, specContent);
  appendGreenfieldCoverageChecklist(prompt, mddContent, "Infra", {
    includeServices: true,
    includeEntities: false,
    includeEndpoints: false,
    includeFlows: false,
    includeBlueprintPhases: true,
    domainInventory: inventory,
  });

  return this.generateResponse(prompt, [], { systemPrompt: INFRA_PROMPT });
}
```

**Razón:** Sin el checklist, el LLM no sabe qué servicios Docker, variables de entorno, ni pipelines debe documentar. El checklist ya existe para otros 6 artifacts; solo falta para Infra.

#### 2.2 Enriquecer infra-prompt.md

Añadir secciones obligatorias:

```markdown
## Contenido obligatorio (proyectos greenfield)
- **CI/CD Pipeline**: GitHub Actions o equivalente con lint, test, build, deploy
- **Cloud Deploy**: ECS Fargate / Cloud Run / K8s según §7 del MDD
- **Variables de entorno**: tabla completa con valor por defecto o referencia a secrets manager
- **mTLS / JWT interno**: estrategia de autenticación entre servicios (§7.2 del MDD)
- **Monitoring**: Sentry DSN, health checks, métricas (§7.5 del MDD)
- **Manifest de infra**: deployment.orchestrator, deployment.provider, jwks_enabled
```

#### 2.3 Añadir `checkInfraVsMdd()` detallado

```typescript
// conformance.service.ts — reemplazar checkInfraVsMdd
export function checkInfraVsMdd(mddContent, infraContent): ConformanceResult {
  const gaps: string[] = [];
  // 1. Extraer tabla de servicios de §7
  const services = extractMddInfraServices(mddContent); // docker, k8s, ecs
  // 2. Verificar cada servicio mencionado en infra doc
  for (const svc of services) {
    if (!infraContent.toLowerCase().includes(svc.name.toLowerCase())) {
      gaps.push(`Falta servicio ${svc.name} en documento Infra`);
    }
  }
  // 3. Extraer variables de entorno de §6/§7
  const envVars = extractMddEnvVars(mddContent);
  // 4. Verificar que .env.example las incluya
  // 5. Verificar CI/CD pipeline mencionado
  // 6. Verificar cloud deploy (si §7 lo requiere)
  return { ok: gaps.length === 0, gaps };
}
```

#### 2.4 Añadir componente I1 a cascade accuracy

```typescript
// cascade-accuracy.util.ts
const I1_INFRA_COMPLETENESS: DocAccuracyComponent = {
  id: "I1_infra",
  weight: 10,
  evaluate: (ctx) => {
    // Verificar: servicios Docker presentes, CI/CD pipeline, cloud deploy,
    // variables de entorno documentadas, manifest de infra
    return { score: 0-100, details: [...] };
  },
};
```

---

## P2 — Use Cases y User Stories thin (sin narrativa)

**Síntoma:** Use Cases = 288 palabras (trigger + 1 paso). User Stories = 924 palabras (template CRUD genérico).

**Causa raíz:** `preferThinLiteraryDocs()` retorna `true` por defecto. Para proyectos HIGH, `omitLiteraryUcUs = true` causa que `buildThinUseCasesFromInventory()` y `buildThinUserStoriesFromInventory()` **byppaseen completamente el LLM** y generen output determinista de plantilla.

**Archivos afectados:**
- `apps/api/src/modules/ai/ai.service.ts` — `preferThinLiteraryDocs()`, `buildThinUseCasesFromInventory()`, `buildThinUserStoriesFromInventory()`
- `apps/api/src/modules/projects/projects.service.ts` — donde se setea `omitLiteraryUcUs`

### Cambios propuestos

#### 3.1 Cambiar default de `omitLiteraryUcUs` a `false`

```typescript
// projects.service.ts
omitLiteraryUcUs: false,  // era: (project.complexity ?? ComplexityLevel.HIGH) === ComplexityLevel.HIGH
```

**Razón:** La lógica original asume que "thin = mejor para cascade accuracy", pero el cascade accuracy **no scoring Use Cases ni User Stories** (C1-C6 no los evalúa). Por lo tanto, hacer thin no mejora el score y degrada la calidad narrativa.

#### 3.2 Añadir scoring de UC/US a cascade accuracy

```typescript
// cascade-accuracy.util.ts — nuevos componentes
const C7_USE_CASES: DocAccuracyComponent = {
  id: "C7_useCases",
  weight: 5,
  evaluate: (ctx) => {
    // Verificar: cada capability tiene ≥1 UC con actor, preconditions,
    // main flow, alt flows, Mermaid diagram
    // Penalizar UCs sin diagrama o sin escenarios alternativos
  },
};

const C8_USER_STORIES: DocAccuracyComponent = {
  id: "C8_userStories",
  weight: 5,
  evaluate: (ctx) => {
    // Verificar: cada capability tiene ≥1 US con acceptance criteria únicos
    // Penalizar US con template genérico "operar C/R/U/D/L sobre X"
  },
};
```

**Razón:** Si el scoring premia UC/US ricos, el LLM generará output de mayor calidad. Actualmente solo premia cobertura de capabilities en MDD/API/Tasks.

#### 3.3 Rediseñar `buildThinUseCasesFromInventory()` como fallback mínimo

Si se quiere mantener thin como opción, que el fallback genere al menos:
- Actor claro (no genérico)
- Preconditions reales
- Happy path con 3-5 pasos
- 2-3 escenarios alternativos
- Referencia a endpoint/API

```typescript
function buildEnhancedThinUseCasesFromInventory(inventory, mddContent): string {
  // En vez de trigger + 1 paso, generar:
  // - Actor from MDD roles
  // - Preconditions from MDD §6
  // - Happy path from Logic Flows §5
  // - Alt flows from error paths in §5
  // - Postconditions from entity state changes
}
```

---

## P3 — Conformance checking débil (gaps no detectados)

**Síntoma:** 15 gaps de conformance (5 API + 5 Blueprint + 5 Infra) que el sistema no detecta ni repara automáticamente.

**Causa raíz:** El conformance checking es heterogéneo: API tiene `checkApiVsMdd()` sólido, pero Blueprint e Infra solo tienen checks de keywords de 3 categorías.

**Archivos afectados:**
- `apps/api/src/modules/engine/conformance.service.ts`
- `apps/api/src/modules/engine/sdd-precision-checks.util.ts`
- `apps/api/src/modules/engine/blueprint-conformance-repair.util.ts`

### Cambios propuestos

#### 4.1 Reforzar `checkBlueprintVsMdd()`

```typescript
// conformance.service.ts
export function checkBlueprintVsMdd(mddContent, blueprintContent): ConformanceResult {
  const gaps: string[] = [];
  // EXISTENTE: stack keywords + entity coverage

  // NUEVO: verificar tablas específicas del MDD §3
  const mddTables = extractMddTableNames(mddContent);
  const blueprintTables = extractBlueprintTableNames(blueprintContent);
  for (const table of mddTables) {
    if (!blueprintTables.includes(table)) {
      gaps.push(`Blueprint no incluye tabla ${table} del MDD §3`);
    }
  }

  // NUEVO: verificar componentes transversales del MDD §2
  const mddServices = extractMddCoreServices(mddContent);
  // ... verificar que blueprint los mencione

  return { ok: gaps.length === 0, gaps };
}
```

#### 4.2 Añadir `repairInfraProgrammaticGaps()`

```typescript
// nuevo archivo: apps/api/src/modules/engine/infra-conformance-repair.util.ts
export function repairInfraProgrammaticGaps(mddContent, infraContent): string {
  // 1. Extraer servicios Docker del MDD §7
  // 2. Extraer variables de entorno de §6/§7
  // 3. Extraer volúmenes de persistencia
  // 4. Inyectar secciones faltantes en infra doc:
  //    - ## CI/CD Pipeline (si §7 lo menciona)
  //    - ## Cloud Deploy (si §7 lo requiere)
  //    - ## Variables de Entorno (tabla completa)
  //    - ## Manifest de Infraestructura
  return repairedInfraContent;
}
```

#### 4.3 Añadir precision checks de infra

```typescript
// sdd-precision-checks.util.ts — nuevas funciones
export function checkInfraDockerServices(mddContent, infraContent): PrecisionGap[] { ... }
export function checkInfraEnvVars(mddContent, infraContent): PrecisionGap[] { ... }
export function checkInfraCicdPipeline(mddContent, infraContent): PrecisionGap[] { ... }
export function checkInfraCloudDeploy(mddContent, infraContent): PrecisionGap[] { ... }
```

---

## P4 — Tasks sin testing/deploy (falta cobertura)

**Síntoma:** No hay tareas de testing (unit, integration, E2E) ni de deploy (Dockerfile, CI/CD, cloud).

**Causa raíz:** El `tasks-prompt.md` pide cobertura de §1-§7 pero no incluye explícitamente testing o deploy como categorías obligatorias.

**Archivos afectados:**
- `apps/api/src/modules/ai/prompts/tasks-prompt.md`

### Cambios propuestos

#### 5.1 Añadir secciones obligatorias al prompt

```markdown
## Categorías obligatorias (además de Backend y Frontend)

### Testing tasks (§8)
- Unit tests para cada módulo CRUD (Jest/Vitest)
- Integration tests para Auth, RBAC, RLS
- E2E tests para flujos críticos (login → session → message)
- Load tests para cola BullMQ
- Cada task de test debe tener: target_files, dependencies sobre la task de implementación, verification command

### Deploy tasks (§9)
- Dockerfile multi-stage optimizado
- CI/CD pipeline (GitHub Actions / GitLab CI)
- Cloud deploy (ECS Fargate / Cloud Run según §7)
- Monitoring setup (Sentry, health checks)
- Variables de entorno en secrets manager
```

#### 5.2 Inyectar testing como dependencia natural

En el prompt, instruir que cada task de implementación tenga una task de testing dependiente:

```markdown
Por cada task de implementación T-NNN, crear una task T-NNN-test:
- dependencies: [T-NNN]
- target_files: [spec/test file corresponding to T-NNN target]
- verification: command to run the test suite
```

---

## P5 — Truncamiento de input context en planner

**Síntoma:** El planner recibe MDD truncado a 24K chars, Blueprint a 12K, etc. Para proyectos extensos, la información se pierde.

**Causa raíz:** `buildPlannerContext()` aplica `.slice(0, N)` agresivo. El `buildSlimTasksPlannerContext()` es aún más agresivo (MDD sections a 3-8K).

**Archivos afectados:**
- `apps/api/src/modules/projects/tasks-generation-pipeline.service.ts` — `buildPlannerContext()`
- `apps/api/src/modules/projects/tasks-planner-context.util.ts` — `buildSlimTasksPlannerContext()`

### Cambios propuestos

#### 6.1 Aumentar caps del planner context

```typescript
// tasks-generation-pipeline.service.ts — buildPlannerContext
const caps = {
  mdd: 40_000,      // era 24_000
  blueprint: 20_000, // era 12_000
  spec: 15_000,      // era 10_000
  apiContracts: 20_000, // era 12_000
  logicFlows: 12_000,    // era 8_000
  infra: 10_000,         // era 6_000
};
```

**Razón:** Con el perfil `document` a 65K tokens de salida, el planner puede recibir más contexto de entrada sin riesgo de saturación.

#### 6.2 Usar MDD sections relevantes en vez de truncar linealmente

```typescript
// tasks-planner-context.util.ts — reemplazar mddSection
function mddSection(md: string, sectionNumber: number, cap: number): string {
  // Extraer solo la sección §N del MDD, no truncar linealmente
  const section = extractMddSection(md, sectionNumber);
  return section.length > cap ? section.slice(0, cap) + "\n…[truncado]" : section;
}
```

**Razón:** Truncar linealmente puede cortar a mitad de una tabla de entidades. Extraer por sección preserva la semántica.

---

## P6 — rawMarkdown duplica YAML front-matter

**Síntoma:** Cada task en tasksJson tiene `rawMarkdown` que contiene el front-matter YAML + el markdown renderizado, duplicando la info del front-matter parsed.

**Causa raíz:** El parser v2 extrae el front-matter pero también preserva el raw markdown completo.

**Archivo afectado:**
- `packages/shared-types/src/tasks-pipeline.ts`
- `apps/api/src/modules/engine/task-v2/tasks-parser-v2.ts`

### Cambios propuestos

#### 7.1 Limpiar rawMarkdown post-parse

```typescript
// tasks-parser-v2.ts — post-parse cleanup
function cleanRawMarkdown(raw: string): string {
  // Remover el bloque ---\n...\n--- del inicio (ya parseado como front-matter)
  return raw.replace(/^---\n[\s\S]*?\n---\n*/m, '').trim();
}
```

**Razón:** El `rawMarkdown` es útil para renderizar la task como checkbox, pero no necesita repetir el YAML que ya está en las campos parsed.

---

## P7 — CLAUDE.md casi vacío en Agent Governance

**Síntoma:** `CLAUDE.md` tiene solo 11 chars dentro del scaffold de agent governance.

**Causa raíz:** La generación de agent governance no produce contenido para Claude Code específicamente.

**Archivo afectado:**
- `apps/api/src/modules/ai/utils/agent-governance.util.ts`
- `packages/shared-types/src/agent-governance.ts`

### Cambios propuestos

#### 8.1 Generar CLAUDE.md con contenido mínimo

```typescript
// agent-governance.util.ts
function generateClaudeMd(project: ProjectContext): string {
  return `# ${project.name} — Claude Code Instructions

## Stack
${project.stackSummary}

## Commands
- Build: \`npm run build\`
- Test: \`npm run test\`
- Lint: \`npm run lint\`

## Architecture
${project.architectureSummary}

## Key Files
${project.keyFiles.map(f => `- ${f}`).join('\n')}
`;
}
```

---

## P8 — Reglas weak en Agent Governance

**Síntoma:** Reglas `orchestrator` y `architecture-patterns` marcadas como "weak".

**Causa raíz:** El scaffold generator no tiene suficiente contexto del proyecto para generar reglas fuertes.

**Archivo afectado:**
- `apps/api/src/modules/ai/utils/agent-governance.util.ts`

### Cambios propuestos

#### 9.1 Enriquecer contexto del governance generator

Inyectar al governance generator:
- Architecture document content (para `architecture-patterns`)
- Logic flows content (para `orchestrator`)
- Blueprint content (para patrones de diseño)

```typescript
// agent-governance.util.ts — enhanceStrength
function enhanceRuleStrength(rule, projectContext): GovernanceRule {
  if (rule.id === "architecture-patterns" && projectContext.architectureContent) {
    rule.strength = "strong";
    rule.content += `\n\n## Arquitectura del proyecto\n${projectContext.architectureContent.slice(0, 3000)}`;
  }
  return rule;
}
```

---

## Priorización

| # | Cambio | Impacto | Esfuerzo | Prioridad |
|---|--------|---------|----------|-----------|
| 1.1 | Aumentar max_tokens document a 65K | Alto | Bajo | 🔴 CRÍTICO |
| 1.2 | Generación chunked por fases | Alto | Medio | 🔴 CRÍTICO |
| 2.1 | Inyectar coverage checklist en Infra | Alto | Bajo | 🔴 CRÍTICO |
| 5.1 | Añadir testing/deploy tasks al prompt | Alto | Bajo | 🔴 CRÍTICO |
| 3.1 | Cambiar omitLiteraryUcUs default a false | Medio | Bajo | 🟡 ALTO |
| 4.1 | Reforzar checkBlueprintVsMdd | Medio | Medio | 🟡 ALTO |
| 2.2 | Enriquecer infra-prompt.md | Medio | Bajo | 🟡 ALTO |
| 6.1 | Aumentar caps planner context | Medio | Bajo | 🟡 ALTO |
| 2.3 | checkInfraVsMdd detallado | Medio | Medio | 🟡 MEDIO |
| 4.2 | repairInfraProgrammaticGaps | Medio | Medio | 🟡 MEDIO |
| 3.2 | Scoring UC/US en cascade accuracy | Bajo | Medio | 🟢 BAJO |
| 1.3 | Flag orphan tasks (T-34) | Bajo | Bajo | 🟢 BAJO |
| 7.1 | Limpiar rawMarkdown post-parse | Bajo | Bajo | 🟢 BAJO |
| 8.1 | Generar CLAUDE.md completo | Bajo | Bajo | 🟢 BAJO |
| 9.1 | Enriquecer governance rules | Bajo | Medio | 🟢 BAJO |

---

## Impacto Esperado

Si se implementan los cambios CRÍTICOS (1.1, 1.2, 2.1, 5.1):

- **Tasks:** Completo sin truncamiento, incluye testing y deploy
- **Infrastructure:** CI/CD, cloud deploy, variables de entorno documentadas
- **PrecisionScore:** De 82 → 90+ (cambio de AMARILLO a VERDE)
- **Conformance:** De 50/100 → 75+ (menos gaps no detectados)

Si se implementan los cambios ALTO (3.1, 4.1, 2.2, 6.1):

- **Use Cases:** De 288 palabras con narrativa real
- **User Stories:** De template CRUD a historias con acceptance criteria
- **Blueprint:** Tablas faltantes detectadas y reparadas automáticamente
- **Planner:** Mejor contexto = mejor plan = mejor tasks
