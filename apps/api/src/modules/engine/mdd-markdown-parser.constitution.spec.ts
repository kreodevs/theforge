import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mddJsonSchema } from "@theforge/shared-types";
import {
  extractConstitutionSignalsFromMarkdown,
  normalizeMddContent,
} from "./mdd-markdown-parser.js";

describe("extractConstitutionSignalsFromMarkdown", () => {
  it("returns template_detected false without new §1 headings", () => {
    const md = "## 1. Contexto\n\nSolo texto.\n\n## 2. Arquitectura\n\nNestJS.";
    const c = extractConstitutionSignalsFromMarkdown(md);
    assert.equal(c.template_detected, false);
  });

  it("detects template and gates when sections are complete", () => {
    const md = `
## 1. Contexto

### Mapa de contextos delimitados (DDD)
- **En alcance del MDD:** A
- **Colindantes:** B
- **Fuera de alcance:** C

### Glosario de dominio (Ubiquitous Language)
| término | def |
| --- | --- |
| Foo | Bar |

### Bloqueantes de negocio (Human-in-the-Loop)
Ninguno

## 2. Arquitectura y Stack
**Decisión:** NestJS **¿Por qué?:** equipo.

## 5. Lógica y Edge Cases
Dado un usuario autenticado
Cuando solicita el recurso
Entonces devuelve 200
`;
    const c = extractConstitutionSignalsFromMarkdown(md);
    assert.equal(c.template_detected, true);
    assert.equal(c.has_context_map, true);
    assert.equal(c.has_glossary, true);
    assert.equal(c.has_gherkin, true);
    assert.equal(c.has_open_blockers, false);
    assert.equal(c.has_stack_rationale, true);
  });
});

describe("normalizeMddContent + mddJsonSchema", () => {
  it("includes constitution in stringified output for semaphore", () => {
    const md = `## 1. Contexto\n\n### Mapa de contextos delimitados\n**En alcance del MDD:** x\n**Colindantes (integración):** y\n**Fuera de alcance explícito:** z\n\n### Glosario de dominio (Ubiquitous Language)\n- **EntidadA:** definición larga suficiente para el umbral del parser.\n- **EntidadB:** otra definición.\n\n## 2. Stack\n**Decisión:** X **¿Por qué?:** razones.\n\n## 3. Modelo\n\n## 4. API\n\n## 5. Lógica y Edge Cases\nDado un cliente válido\nCuando invoca la operación\nEntonces recibe confirmación\n`;
    const n = normalizeMddContent(md);
    const parsed = mddJsonSchema.parse(JSON.parse(JSON.stringify(n)));
    assert.equal(parsed.constitution?.template_detected, true);
    assert.equal(parsed.constitution?.has_stack_rationale, true);
  });
});
