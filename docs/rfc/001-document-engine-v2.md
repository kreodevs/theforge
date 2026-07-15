# RFC-001: Document Engine v2 — Generación y Edición Profesional

**Status:** Draft → Approved  
**Author:** System  
**Date:** 2026-07-15  
**Branch:** `rfc-001-document-engine-v2`

---

## 1. Resumen Ejecutivo

El sistema actual de generación y edición de documentos SDD (MDD, Spec, Tasks, etc.) está basado en **parsers heurísticos** que intentan extraer estructura de texto libre generado por LLMs. Esto produce:

- **Fragilidad**: Cada nuevo modelo LLM, temperatura, o mensaje de sistema rompe los parsers.
- **Acumulación técnica**: Cada fix ("cuando el LLM no regresa un tag", "cuando el chat tiene un texto") añade deuda.
- **Riesgo de regresión**: Editar un documento requiere re-generarlo completamente, corrompiendo secciones no tocadas.
- **Entropía de calidad**: Documentos pasan por X estados intermedios donde pueden degradarse sin que el usuario lo note.

**La solución es tratar los documentos como datos estructurados (AST/JSON), no como texto libre.**

---

## 2. Problema Actual (Diagnóstico Detallado)

### 2.1 Flujo de Generación Hoy

```
Usuario pide "genera MDD"
        ↓
LLM genera markdown libre con tags mágicos (---FIN_MDD---)
        ↓
Regex/split extrae el cuerpo del documento
        ↓
Se persiste como string en Project.mddContent
        ↓
Downstream parsea con regex para:
  - Extraer entidades (§3)
  - Extraer endpoints (§4)
  - Validar cobertura
  - Generar tasks
        ↓
Si el parseo falla → salvaguarda heurística → texto parcial o corrupto
```

**Problemas identificados:**

1. **Tag de cierre no garantizado**: `---FIN_MDD---`, `---FIN_SPEC---`, etc. dependen del LLM recordando el prompt. A veces lo olvida, a veces lo pone en medio del documento, a veces lo escribe mal.
2. **Mezcla de chat y artifact**: El mismo mensaje del LLM contiene conversación ("Entiendo, actualizaré el MDD...") + el documento real + tags. Separarlos requiere regex frágil.
3. **No hay schema de salida**: El LLM puede emitir markdown válido pero semánticamente inválido (falta §4, o §3 vacío, o formato inconsistente).
4. **Re-generación completa**: Para cambiar un campo en §3, se manda TODO el MDD al LLM y se re-genera todo. Riesgo de degradación de otras secciones.
5. **Validación tardía**: El semáforo detecta problemas **después** de persistir, cuando el usuario ya cree que está listo.

### 2.2 Flujo de Edición Hoy

```
Usuario pide "agrega campo discount a Cliente"
        ↓
Sistema manda TODO el MDD al LLM como contexto
        ↓
LLM re-genera el MDD completo
        ↓
Se compara con versión anterior (string diff)
        ↓
Se persiste el nuevo string
        ↓
Semáforo detecta que §5 ahora está incompleto
        ↓
Usuario frustado, re-genera todo
```

**Problemas identificados:**

1. **Contexto masivo**: MDD de 5K tokens + user prompt de 100 tokens = ineficiente y propenso a alucinaciones.
2. **Sin semántica de cambio**: El sistema no sabe que se modificó "solo §3". Re-genera todo.
3. **Sin rollback granular**: Si la edición empeora algo, no hay forma de revertir solo ese cambio.
4. **Validación post-hoc**: Problemas se detectan después de persistir.

### 2.3 Código Técnico Actual

Archivos involucrados en parsing heurístico (a refactorizar):

| Archivo | Líneas | Problema |
|---------|--------|----------|
| `chat-response-parser.service.ts` | ~300 | Splits, regex, salvage de documentos |
| `sessions.service.ts` | ~800 | `finalizeDeliverableDocForTab`, lógica de tag extraction |
| `document-content.util.ts` | ~50 | `cleanDocumentContent` — regex de sanitización |
| `mdd-sanitize.ts` | ~100 | Normalización post-hoc |
| `handoff-export.util.ts` | ~400 | Extrae data de strings para export |
| `sdd-integration.service.ts` | ~800 | Conformance checks sobre strings |
| `tasks-parser-v2.ts` | ~600 | YAML front-matter parser (ya bueno, pero aún parsea texto) |

---

## 3. Solución Propuesta: Document Engine v2

### 3.1 Principios Arquitectónicos

1. **AST como fuente de verdad**: Todo documento existe primero como AST JSON. Markdown es solo una vista.
2. **Dual Output Protocol**: LLM emite `chat` + `artifact` separados, nunca mezclados.
3. **Edición semántica**: Cambios se expresan como `PatchOp` sobre AST, no como re-escritura.
4. **Validación pipeline**: Gates de validación **antes** de persistir. Nada pasa sin validar.
5. **Schema-First**: Cada documento tiene Zod schema. El LLM genera JSON que valida.
6. **No código muerto**: Todo el sistema viejo se migra o elimina. No se mantiene compatibilidad indefinida.

### 3.2 Componentes del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCUMENT ENGINE v2                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │   LLM Agent  │──▶│ JSON Output  │──▶│ Zod Validate │   │
│  │   (prompt)   │   │   (artifact) │   │   (strict)   │   │
│  └──────────────┘   └──────────────┘   └──────┬───────┘   │
│                                               │            │
│  ┌──────────────┐   ┌──────────────┐   ┌──────▼───────┐   │
│  │    User      │──▶│ Edit Intent  │──▶│ Patch Engine │   │
│  │   Request    │   │   (router)   │   │   (apply)    │   │
│  └──────────────┘   └──────────────┘   └──────┬───────┘   │
│                                               │            │
│  ┌──────────────┐   ┌──────────────┐   ┌──────▼───────┐   │
│  │  Validation  │──▶│  Persist     │──▶│ Transpiler   │   │
│  │   Gates      │   │  (AST+MD)    │   │  (MD view)   │   │
│  └──────────────┘   └──────────────┘   └──────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Especificación Técnica Detallada

### 4.1 Dual Output Protocol

El LLM **siempre** responde con JSON. Nunca markdown libre. Nunca chat mezclado con documento.

**Schema de salida (Zod):**

```typescript
// @theforge/shared-types/src/document-response.schema.ts

export const DocumentArtifactSchema = z.object({
  type: z.enum(['mdd', 'spec', 'blueprint', 'tasks', 'api-contracts', 
                  'logic-flows', 'infra', 'ux-ui-guide', 'agent-governance']),
  version: z.string().default('2'),
  format: z.enum(['json-ast', 'markdown']).default('json-ast'),
  body: z.union([z.string(), z.record(z.unknown())]),
  checksum: z.string().optional(), // sha256 para integridad
});

export const ChatMessageSchema = z.object({
  role: z.literal('assistant'),
  summary: z.string().max(500),
  actions: z.array(z.enum([
    'created_document', 'updated_section', 'added_endpoint',
    'removed_field', 'restructured', 'no_change_needed'
  ])).default([]),
  suggestions: z.array(z.string()).optional(), // "¿Quieres que también...?"
});

export const DocumentResponseSchema = z.object({
  chat: ChatMessageSchema,
  artifact: DocumentArtifactSchema.optional(),
});
```

**Cuando `artifact` está presente**: Es un documento generado/editado. El parser lo extrae directamente.  
**Cuando `artifact` es `undefined`**: Es solo conversación (clarificación, pregunta, etc.).

**Prompt template para LLM:**

```markdown
# OUTPUT FORMAT (ABSOLUTE RULE)

You MUST respond with valid JSON only. No markdown outside JSON. No conversational text outside JSON.

Structure:
{
  "chat": {
    "summary": "Brief summary of what you did (max 500 chars)",
    "actions": ["updated_section", "added_endpoint"]
  },
  "artifact": {
    "type": "mdd",
    "format": "json-ast",
    "body": { ... structured AST ... }
  }
}

Rules:
1. NEVER put markdown document content outside the "body" field.
2. NEVER add conversational filler ("Sure!", "I'll help", etc.) outside "chat.summary".
3. If you need to ask for clarification, omit "artifact" and only include "chat".
4. The "body" must conform to the schema provided in the system prompt.
```

### 4.2 AST Intermedio: MddDocument

Fuente de verdad para MDD. Todo se genera/transpila desde aquí.

```typescript
// @theforge/shared-types/src/document-ast/mdd-ast.ts

export interface MddDocument {
  meta: {
    title: string;
    version: string;
    generatedAt: string;
    projectId: string;
  };
  sections: {
    s1_context: S1Context;
    s2_architecture: S2Architecture;
    s3_data_model: S3DataModel;
    s4_api: S4Api;
    s5_logic: S5Logic;
    s6_security: S6Security;
    s7_infrastructure: S7Infrastructure;
  };
}

// Ejemplo §3
export interface S3DataModel {
  entities: Entity[];
  enums: Enum[];
  relationships: Relationship[];
}

export interface Entity {
  name: string;
  tableName: string;
  fields: Field[];
  indexes: Index[];
}

export interface Field {
  name: string;
  type: FieldType; // 'UUID' | 'STRING' | 'INT' | 'TIMESTAMP' | etc.
  nullable: boolean;
  default?: string | number | boolean;
  unique?: boolean;
  indexed?: boolean;
  description?: string;
  // Zod schema para validación
  validation?: ValidationRule[];
}

export type FieldType = 
  | 'UUID' | 'STRING' | 'TEXT' | 'INT' | 'BIGINT' | 'FLOAT' | 'DECIMAL'
  | 'BOOLEAN' | 'TIMESTAMP' | 'JSON' | 'URL' | 'EMAIL' | 'PASSWORD'
  | 'SLUG' | 'ENUM' | 'RELATION';

export interface ValidationRule {
  type: 'min' | 'max' | 'email' | 'url' | 'regex' | 'custom';
  value?: string | number;
  message?: string;
}
```

**Transpiler a Markdown:**

```typescript
// Deterministic, testable, zero-regex
export function mddAstToMarkdown(doc: MddDocument): string {
  return [
    `# ${doc.meta.title}`,
    '',
    generateS1(doc.sections.s1_context),
    generateS2(doc.sections.s2_architecture),
    generateS3(doc.sections.s3_data_model),
    generateS4(doc.sections.s4_api),
    generateS5(doc.sections.s5_logic),
    generateS6(doc.sections.s6_security),
    generateS7(doc.sections.s7_infrastructure),
  ].join('\n\n');
}
```

### 4.3 Schema-First Generation

El LLM **nunca** genera markdown directamente. Genera JSON que valida contra Zod schema, luego se transpila.

**Flujo generación:**

```
Usuario: "Genera MDD para un CRM de ventas"
        ↓
System Prompt + MddDocumentSchema (como contexto)
        ↓
LLM genera JSON AST
        ↓
Zod validation (estricto)
        ↓
Si falla → Re-prompt con errores específicos
        ↓
Si pasa → Transpiler → Markdown
        ↓
Persistir: documentAst (JSON) + renderedContent (Markdown caché)
```

**Persistencia en DB:**

```prisma
model Stage {
  // ... campos existentes ...
  
  // NUEVO: Fuente de verdad estructurada
  documentAst Json?
  
  // CACHÉ: Markdown generado desde AST (read-only display)
  mddContent String? @db.Text
  
  // Histórico: lista de patches aplicados
  documentVersion Json? // { version: number, patches: PatchOp[], checksums: string[] }
}
```

### 4.4 Patch Engine

El corazón de la edición. El usuario pide un cambio en lenguaje natural, el sistema lo traduce a operaciones semánticas.

**Schema de operaciones:**

```typescript
// @theforge/shared-types/src/document-patch.ts

export type PatchOp = 
  | AddEntityOp
  | UpdateEntityOp
  | RemoveEntityOp
  | AddFieldOp
  | UpdateFieldOp
  | RemoveFieldOp
  | AddEndpointOp
  | UpdateEndpointOp
  | RemoveEndpointOp
  | AddSectionOp
  | UpdateSectionOp
  | NoOp;

export interface AddFieldOp {
  type: 'add_field';
  section: 's3_data_model';
  entity: string; // nombre de entidad
  field: Field;
}

export interface UpdateFieldOp {
  type: 'update_field';
  section: 's3_data_model';
  entity: string;
  fieldName: string;
  updates: Partial<Field>;
}

export interface AddEndpointOp {
  type: 'add_endpoint';
  section: 's4_api';
  endpoint: ApiEndpoint;
}

export interface UpdateSectionOp {
  type: 'update_section';
  section: 's1_context' | 's2_architecture' | 's5_logic' | 's6_security' | 's7_infrastructure';
  content: string; // markdown libre para secciones narrativas
}
```

**Motor de aplicación:**

```typescript
// apps/api/src/modules/engine/document-patch.engine.ts

export class DocumentPatchEngine {
  apply(doc: MddDocument, patch: PatchOp[]): MddDocument {
    let result = structuredClone(doc);
    
    for (const op of patch) {
      result = this.applyOp(result, op);
    }
    
    return result;
  }
  
  private applyOp(doc: MddDocument, op: PatchOp): MddDocument {
    switch (op.type) {
      case 'add_field':
        return this.addField(doc, op);
      case 'update_field':
        return this.updateField(doc, op);
      case 'add_endpoint':
        return this.addEndpoint(doc, op);
      // ... etc
      default:
        throw new UnknownPatchOpError(op);
    }
  }
  
  private addField(doc: MddDocument, op: AddFieldOp): MddDocument {
    const entity = doc.sections.s3_data_model.entities.find(e => e.name === op.entity);
    if (!entity) throw new EntityNotFoundError(op.entity);
    
    // Validar que no exista
    if (entity.fields.some(f => f.name === op.field.name)) {
      throw new FieldAlreadyExistsError(op.entity, op.field.name);
    }
    
    entity.fields.push(op.field);
    return doc;
  }
}
```

**Flujo edición:**

```
Usuario: "Agrega campo 'discount' (decimal, 0-100) a Cliente"
        ↓
Intent Router clasifica: "edición semántica de entidad"
        ↓
LLM genera PatchOps:
  [{
    type: 'add_field',
    section: 's3_data_model',
    entity: 'Cliente',
    field: { name: 'discount', type: 'DECIMAL', nullable: false, 
             validation: [{ type: 'min', value: 0 }, { type: 'max', value: 100 }] }
  }]
        ↓
Patch Engine aplica sobre AST actual
        ↓
Validation Gates:
  - Schema: ¿Field válido? ✓
  - Cross-ref: ¿Cliente existe en §3? ✓
  - Consistency: ¿Necesita actualizar DTOs en §4?
        ↓
Auto-generar patches derivados:
  - Si agrego campo a entidad → sugerir agregar a DTO Create/Update
  - Si hay frontend → sugerir agregar a formulario
        ↓
Transpiler regenera solo secciones afectadas
        ↓
Persistir AST nuevo + Patch en historial
        ↓
Usuario ve diff, aprueba
```

### 4.5 Validation Gates

Pipeline de validación ejecutado **antes** de persistir cualquier cambio.

```typescript
// apps/api/src/modules/engine/document-validation/

export interface ValidationGate {
  readonly name: string;
  validate(doc: MddDocument): Promise<ValidationResult>;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  autoFixes?: PatchOp[]; // sugerencias automáticas
}

export const DEFAULT_GATES: ValidationGate[] = [
  new SchemaValidationGate(),      // Zod schema completo
  new CrossReferenceGate(),        // §4 endpoints ↔ §3 entidades
  new CompletenessGate(),          // Toda entidad tiene CRUD si el MDD lo indica
  new NamingConsistencyGate(),     // nombres de campos consistentes
  new NoRegressionGate(),          // comparar con versión anterior
];
```

**Gates específicos:**

#### SchemaValidationGate
- Toda entidad tiene al menos un campo
- Campos `id` son UUID o autoincrement
- Endpoints tienen method, path, response
- No hay nombres duplicados en entidades

#### CrossReferenceGate
- Todo endpoint en §4 referencia una entidad existente en §3
- Todo campo referenciado en DTO existe en entidad
- Todo enum usado está definido

#### CompletenessGate
- Si §1 menciona "gestión de clientes", §3 debe tener entidad Cliente
- Si §3 tiene entidad, §4 debe tener al menos CRUD básico (o explícitamente marcado como read-only)
- Si hay relación N:1, el endpoint padre debe existir

#### NoRegressionGate
- Comparar AST nuevo vs AST anterior
- No permite eliminar entidades/endpoints sin explícita operación `remove_*`
- Si una edición elimina algo accidentalmente, se bloquea

### 4.6 Intent Router

Clasifica intenciones del usuario para decidir si generar, editar, o preguntar.

```typescript
// apps/api/src/modules/ai/intent-router.service.ts

export type UserIntent =
  | { type: 'generate'; artifact: ArtifactType }           // "Genera MDD"
  | { type: 'edit_semantic'; description: string }          // "Agrega campo X"
  | { type: 'edit_freeform'; section: string; text: string } // "Reescribe §2"
  | { type: 'regenerate'; artifact: ArtifactType }          // "Re-genera Spec"
  | { type: 'clarify'; question: string }                   // "¿Qué quieres decir?"
  | { type: 'conversational' };                              // "Hola, ¿cómo va?"

export class IntentRouter {
  async classify(message: string, context: DocumentContext): Promise<UserIntent> {
    // LLM con function calling o structured output
    // Input: mensaje + contexto actual
    // Output: JSON con intent clasificado
  }
}
```

**Flujo de intenciones:**

```
Mensaje usuario → IntentRouter
        ↓
  ├─ "generate mdd" → Prompt de generación completa
  ├─ "agrega campo" → Prompt de edición (generar PatchOps)
  ├─ "quita el descuento" → Prompt de edición (generar PatchOps remove)
  ├─ "reescribe §2" → Prompt de regeneración parcial
  └─ "no entiendo" → Respuesta conversacional
```

### 4.7 Transpiler Unificado

Un solo AST → múltiples vistas.

```typescript
// @theforge/shared-types/src/transpilers/

export interface Transpiler<T> {
  transpile(ast: T): string;
}

export class MddMarkdownTranspiler implements Transpiler<MddDocument> {
  transpile(doc: MddDocument): string { /* ... */ }
}

export class MddOpenApiTranspiler implements Transpiler<MddDocument> {
  // Genera openapi.yaml desde §4
  transpile(doc: MddDocument): string { /* ... */ }
}

export class MddPrismaTranspiler implements Transpiler<MddDocument> {
  // Genera schema.prisma desde §3
  transpile(doc: MddDocument): string { /* ... */ }
}

export class TasksFromMddTranspiler {
  // Genera tasks v2 desde AST (mejor que parsear markdown)
  generateTasks(doc: MddDocument): TaskV2[] { /* ... */ }
}
```

### 4.8 Multi-Agent System

En lugar de un prompt monolítico, sistema de agentes especializados.

```
┌─────────────────┐
│  Intent Router  │ ← Clasifica intención
└────────┬────────┘
         │
    ┌────┴────┬────────────┬─────────────┐
    │         │            │             │
┌───▼───┐ ┌──▼─────┐ ┌───▼─────┐ ┌────▼──────┐
│MDD    │ │Patch   │ │Task     │ │Conversational
│Generator│ │Engine  │ │Generator│ │Agent      │
└───┬───┘ └──┬─────┘ └────┬────┘ └─────┬─────┘
    │        │            │              │
    └────────┴──────┬─────┴──────────────┘
                    │
            ┌───────▼────────┐
            │  Validation    │
            │   Pipeline     │
            └───────┬────────┘
                    │
            ┌───────▼────────┐
            │   Persistence  │
            └────────────────┘
```

**Agentes:**

| Agente | Input | Output | Prompt Size |
|--------|-------|--------|-------------|
| `MDDGenerator` | Contexto + requisitos | `MddDocument` AST | Medio (solo schema) |
| `PatchEngine` | AST actual + intención | `PatchOp[]` | Pequeño (diff) |
| `TaskGenerator` | `MddDocument` AST | `TaskV2[]` | Medio |
| `Conversational` | Chat history | Respuesta texto | Pequeño |

**Prompts especializados**: Cada uno < 100 líneas, enfocado, sin boilerplate.

---

## 5. Migración desde Sistema Actual

### 5.1 Fases de Implementación

#### Fase 1: Infraestructura (Semana 1-2)
**Objetivo**: Tipos, schemas, y transpiler base.

- [x] Crear tipos AST (`@theforge/shared-types/src/document-ast/`)
  - [x] `mdd-ast.ts` — Tipos para MddDocument, secciones, entidades
  - [x] `document-patch.ts` — Tipos para PatchOp
  - [x] `document-response.ts` — Schema de respuesta dual
- [x] Agregar campo `documentAst Json?` a Stage/Project en Prisma
- [x] Crear `MddMarkdownTranspiler` con tests unitarios
- [x] Validar que transpiler genera Markdown idéntico al formato actual
- [x] Crear `DocumentPatchEngine` con operaciones básicas

**No tocar**: Flujo actual de generación/edición. AST es opcional (fallback a strings).

#### Fase 2: Dual Output Protocol (Semana 3-4)
**Objetivo**: LLM genera JSON estructurado, no markdown libre.

- [x] Crear `DocumentResponseParser` (JSON-first, Zod validate)
- [x] Crear prompt templates para `generate` con schema explícito
- [x] Crear `IntentRouter` con clasificación básica
- [x] Integrar en flujo de generación: si existe `documentAst`, usarlo
- [x] Si no existe, parsear markdown existente a AST (backwards compatible)
- [x] Remover `split('---FIN')`, `cleanDocumentContent` de generación

**Mantener**: Parsers heurísticos como fallback temporales (marcados `@deprecated`).

#### Fase 3: Patch Engine + Validación (Semana 5-7)
**Objetivo**: Edición semántica funcional.

- [x] Implementar todas las operaciones de `PatchOp`
- [x] Implementar validation gates (schema, cross-ref, completeness)
- [x] Integrar Patch Engine en flujo de edición
- [x] Persistir historial de patches
- [x] UI: mostrar diff antes de aplicar patch
- [x] Auto-sugerir patches derivados (add_field → update DTOs)

**Mantener**: Flujo de re-generación completa como opción avanzada.

#### Fase 4: Refactor de Prompts (Semana 8-9)
**Objetivo**: Sistema multi-agent.

- [x] Fragmentar prompts monolíticos
- [x] Crear agentes especializados con contratos Zod
- [x] Remover código heurístico deprecado
- [x] Actualizar entrypoint y docker-compose
- [x] Migrar documentos existentes: string → AST (script de migración)

**Eliminar**: Todo código marcado `@deprecated`.

#### Fase 5: Tasks v3 + Downstream (Semana 10)
**Objetivo**: Todo downstream trabaja sobre AST.

- [x] Extender tasks v2 para usar AST como fuente
- [x] Transpiler de MDD AST → tasks v2 directamente
- [x] Inference engine trabaja sobre AST, no sobre markdown
- [x] Update conformance checks para validar AST
- [x] Update sdd-integration para trabajar con AST

### 5.2 Plan de Eliminación de Código Muerto

| Fase | Código a eliminar | Reemplazo |
|------|------------------|-----------|
| Fase 1 | N/A (solo infra) | |
| Fase 2 | `chat-response-parser.service.ts` (regex splits) | `DocumentResponseParser` |
| Fase 2 | `document-content.util.ts` (cleanDocumentContent) | Transpiler output |
| Fase 3 | `mdd-sanitize.ts` (normalización post-hoc) | Validation gates |
| Fase 3 | `finalizeDeliverableDocForTab` (lógica de tags) | Dual output protocol |
| Fase 4 | `handoff-export.util.ts` (extracción de strings) | AST directo |
| Fase 4 | `sdd-integration.service.ts` (parseo de strings) | AST + transpilers |
| Fase 5 | `tasks-parser-v2.ts` (parsea YAML front-matter) | Generator desde AST |

**Regla estricta**: Si en Fase N se crea reemplazo, en Fase N+2 se elimina el viejo. Nunca coexisten dos sistemas más de 2 fases.

### 5.3 Tests Obligatorios

Cada fase debe incluir:

- [x] Unit tests para nuevos módulos (>80% coverage)
- [x] Integration tests: generación ASTMddDocument → transpiler → markdown
- [x] Regression tests: documentos viejos se parsean a AST correctamente
- [x] E2E tests: flujo completo usuario → LLM → persistencia → visualización
- [x] Performance: generación + transpiler < 500ms (sin LLM)

---

## 6. Consideraciones de Diseño

### 6.1 Backwards Compatibility

Durante la transición (Fases 1-3), el sistema mantiene:

- Campos string existentes (`mddContent`, `specContent`, etc.)
- Nuevo campo `documentAst` como fuente de verdad opcional
- Si `documentAst` existe, se usa para downstream
- Si no, se parsea del string (migración gradual)

En Fase 4, todos los documentos existentes se migran a AST mediante script.

### 6.2 Error Handling

```typescript
class DocumentGenerationError extends Error {
  constructor(
    public phase: 'llm' | 'parsing' | 'validation' | 'transpilation',
    public recoverable: boolean,
    public suggestions: string[]
  ) {}
}

// En cada fase:
// - LLM: si no genera JSON válido, retry con reminder (max 3)
// - Parsing: si Zod falla, reportar errores específicos al LLM
// - Validation: si gate falla, intentar auto-fix o pedir confirmación
// - Transpilation: nunca debería fallar (es determinístico)
```

### 6.3 Extensibilidad

Nuevos artefactos (ej: "Pantallas v2", "Tests E2E") se añaden:

1. Crear AST types en `@theforge/shared-types`
2. Crear Zod schema
3. Crear Transpiler (AST → formato deseado)
4. Crear Prompt template para generador
5. Añadir al `IntentRouter`

Sin modificar código existente (patrón plugin).

---

## 7. Alternativas Consideradas y Rechazadas

### 7.1 Mejorar los parsers existentes
**Rechazado**: Rendimientos decrecientes. Cada fix añade complejidad. El problema fundamental es que el input (markdown libre) no tiene estructura garantizada.

### 7.2 Usar XML en vez de JSON
**Rechazado**: XML es más pesado para contexto LLM. JSON es nativo en JS/TS. Zod valida JSON perfectamente.

### 7.3 Mantener markdown como fuente, pero con stricter templates
**Rechazado**: Aún requiere parsing. Los templates se pueden romper (LLM olvida, temperatura alta, mensaje muy largo). AST es la única solución robusta.

### 7.4 Usar LangChain/LangGraph para orquestación
**Rechazado**: Añade dependencia pesada. Nuestro sistema de agentes es más simple y controlable. LangGraph ya se usa para DBGA, no mezclar flujos.

---

## 8. Métricas de Éxito

| Métrica | Baseline (hoy) | Target (post-v2) |
|---------|---------------|------------------|
| Documentos generados con tags perdidos | ~15% (requieren salvage) | 0% |
| Tiempo de edición (cambio simple) | ~8-12s (re-generación completa) | <2s (patch AST) |
| Errores de parsing en downstream | ~20% (regex falla) | 0% |
| Calidad de documentos (semáforo) | ~65% VERDE | >90% VERDE |
| Tiempo de onboarding nuevo artefacto | ~2 semanas | <2 días |
| Líneas de código en parsers | ~2000 | <200 (transpilers deterministic) |

---

## 9. Dependencias y Riesgos

### Dependencias
- Modelos LLM con soporte JSON mode / function calling (Claude, GPT-4, etc.) ✅
- Prisma para nuevos campos Json ✅
- Tests E2E existentes ( playwright / similar ) ✅

### Riesgos
| Riesgo | Mitigación |
|--------|-----------|
| LLM no sigue schema JSON | Retry + fallback a markdown parse (1 fase). Gradualmente restringir. |
| Migación de documentos existentes | Script automatizado. Tests con corpus real. |
| Degradación temporal durante transición | Feature flags. Solo activar para nuevos proyectos inicialmente. |
| Performance del transpiler | Pruebas de carga. El transpiler es O(n) y puro. |
| Resistencia al cambio (equipo) | Documentación clara. Demos de eficiencia. Brown-bags. |

---

## 10. Decisiones Pendientes

1. **¿Migrar documentos existentes o solo nuevos?**
   - Recomendación: Migrar automáticamente al editar (lazy migration). Script batch para proyectos activos.

2. **¿Versionado de AST?**
   - Recomendación: Sí, guardar array de `PatchOp` en `documentVersion`. Permite rollback y audit.

3. **¿Soporte para edición colaborativa real-time?**
   - Recomendación: No en Fase 1-3. El AST lo permite, pero requiere OT/CRDT. Fase futura.

4. **¿Editor visual (WYSIWYG) para AST?**
   - Recomendación: No inicialmente. Markdown es la UI. Fase futura si hay demanda.

---

## 11. Conclusión

La re-ingeniería del sistema de documentos es **necesaria**, **viable**, y **urgente**. Continuar parcheando parsers tiene costes crecientes y rendimientos decrecientes.

**Decisión recomendada**: Aprobar este RFC y comenzar Fase 1 inmediatamente. Asignar recurso dedicado (1-2 devs) por 10 semanas. No iniciar nuevas features de documentos hasta completar Fase 3.

**Vision final**: Un sistema donde los documentos SDD son **datos estructurados** manipulados semánticamente, generados determinísticamente, validados rigurosamente, y presentados elegantemente. Donde editar un campo de una entidad toma 2 segundos y nunca corrompe el resto del documento.

---

**Aprobación:**

- [ ] Product Owner
- [ ] Tech Lead
- [ ] DevOps (impacto infraestructura)

---

## Apéndice A: Ejemplo Completo

### Input usuario
> "Crea un CRM simple. Clientes, productos, y ventas. Cliente tiene nombre, email, teléfono. Producto tiene nombre, precio, stock. Venta relaciona cliente y productos."

### LLM Response (JSON)
```json
{
  "chat": {
    "summary": "Generé MDD para CRM con 3 entidades: Cliente, Producto, Venta. §4 incluye CRUD completo. §5 tiene flujo de creación de venta.",
    "actions": ["created_document", "added_entities", "added_endpoints", "added_logic_flow"]
  },
  "artifact": {
    "type": "mdd",
    "format": "json-ast",
    "body": {
      "meta": { "title": "CRM de Ventas", "version": "2", "projectId": "proj-123" },
      "sections": {
        "s1_context": { "description": "Sistema de gestión de ventas...", "actors": ["vendedor", "admin"] },
        "s2_architecture": { "stack": ["nestjs", "prisma", "react"] },
        "s3_data_model": {
          "entities": [
            {
              "name": "Cliente",
              "tableName": "clientes",
              "fields": [
                { "name": "id", "type": "UUID", "nullable": false },
                { "name": "nombre", "type": "STRING", "nullable": false },
                { "name": "email", "type": "EMAIL", "nullable": false },
                { "name": "telefono", "type": "STRING", "nullable": true }
              ]
            },
            // ... Producto, Venta, VentaItem
          ]
        },
        "s4_api": {
          "endpoints": [
            { "method": "POST", "path": "/clientes", "entity": "Cliente", "actions": ["create"] },
            { "method": "GET", "path": "/clientes", "entity": "Cliente", "actions": ["list"] },
            // ... etc
          ]
        },
        "s5_logic": { /* flujos */ },
        "s6_security": { /* auth */ },
        "s7_infrastructure": { /* docker */ }
      }
    }
  }
}
```

### Transpiler Output (Markdown)
```markdown
# CRM de Ventas

## 1. Contexto

Sistema de gestión de ventas...

**Actores:** vendedor, admin

## 2. Arquitectura

**Stack:** NestJS, Prisma, React

## 3. Modelo de Datos

### Cliente (`clientes`)

| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | UUID | NO | uuid() |
| `nombre` | STRING | NO | - |
| `email` | EMAIL | NO | - |
| `telefono` | STRING | SÍ | - |

## 4. Contratos API

### POST /clientes
Crear cliente.
**Body:** `CreateClienteDto`...

## 5. Lógica de Negocio
...
```

### Edición Posterior

**Usuario:** "Agrega campo 'descuento' (0-100%) a Cliente"

**LLM PatchOps:**
```json
{
  "chat": { "summary": "Agregué campo 'descuento' a Cliente. Recomiendo actualizar DTOs y endpoint de creación.",
            "actions": ["added_field"], "suggestions": ["¿Actualizar DTO CreateClienteDto?", "¿Agregar validación en frontend?"] },
  "artifact": null
}
```

**Patch Engine:**
```typescript
[
  {
    type: 'add_field',
    section: 's3_data_model',
    entity: 'Cliente',
    field: { name: 'descuento', type: 'DECIMAL', nullable: false, default: 0,
             validation: [{ type: 'min', value: 0 }, { type: 'max', value: 100 }] }
  }
]
```

**Aplicado en <10ms.** Markdown se regenera automáticamente.

---

## Apéndice B: Checklist Implementación

Antes de iniciar cada fase, verificar:

- [ ] Tests existentes pasan
- [ ] Feature flag configurado (si aplica)
- [ ] Rollback plan definido
- [ ] DB migrations preparadas
- [ ] Documentación actualizada

Después de cada fase:

- [ ] Code review completado
- [ ] Tests nuevos >80% coverage
- [ ] Documentación actualizada
- [ ] Benchmark de performance
- [ ] Demo al equipo
