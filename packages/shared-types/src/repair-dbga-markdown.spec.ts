import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDocumentMarkdown } from "./format-document-markdown.js";
import {
  promoteBareDbgaSectionHeadings,
  repairFlowStepPseudoTables,
  repairGluedDbgaBullets,
  unwrapMarkdownInTextFences,
} from "./repair-dbga-markdown.js";

const DBGA_HEADER = "# Domain Benchmark & Gap Analysis (DBGA)\n\n";

describe("repair-dbga-markdown", () => {
  it("unwrapMarkdownInTextFences libera ## 5. Reglas dentro de ```text", () => {
    const input = `${DBGA_HEADER}\`\`\`text
## 5. Reglas de Negocio
-**R5.1** - Ventana de Ejecución
\`\`\``;
    const out = unwrapMarkdownInTextFences(input);
    assert.match(out, /^## 5\. Reglas de Negocio/m);
    assert.doesNotMatch(out, /```text[\s\S]*## 5/);
  });

  it("repairFlowStepPseudoTables convierte tablas rotas a lista ordenada", () => {
    const input = `|  | 1. | Al iniciar, detecta ausencia de Superadmin. |
| --- | --- | --- |
|  | 2. | Redirige al formulario de inicialización. |`;
    const out = repairFlowStepPseudoTables(input);
    assert.match(out, /^1\. Al iniciar/m);
    assert.match(out, /^2\. Redirige/m);
    assert.doesNotMatch(out, /^\|/m);
  });

  it("promoteBareDbgaSectionHeadings promueve 7. Roles y Permisos", () => {
    const input = `${DBGA_HEADER}7. Roles y Permisos\n| Rol | Permisos |`;
    const out = promoteBareDbgaSectionHeadings(input);
    assert.match(out, /^## 7\. Roles y Permisos/m);
  });

  it("repairGluedDbgaBullets separa -**R5.1**", () => {
    const out = repairGluedDbgaBullets("-**R5.1** - Ventana de ejecución");
    assert.equal(out, "- **R5.1** - Ventana de ejecución");
  });

  it("formatDocumentMarkdown repara bloque de flujos en pseudo-tabla", () => {
    const input = `${DBGA_HEADER}## 6. Flujos Principales
Primer arranque del sistema (sin superadmin)
\`\`\`text
|  | 1. | Al iniciar, detecta ausencia de Superadmin. |
| --- | --- | --- |
|  | 2. | Redirige al formulario. |
\`\`\``;
    const out = formatDocumentMarkdown(input);
    assert.match(out, /## 6\. Flujos Principales/);
    assert.match(out, /^1\. Al iniciar/m);
    assert.doesNotMatch(out, /```text[\s\S]*\|  \| 1\./);
  });
});
