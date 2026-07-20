import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDocumentMarkdown } from "./format-document-markdown.js";
import { repairSplitOrderedListItems } from "./repair-split-ordered-list-items.js";

describe("repairSplitOrderedListItems", () => {
  it("fusiona número suelto y texto en la línea siguiente (con línea en blanco)", () => {
    const raw = `## 6. Reglas de Negocio, Políticas y Fórmulas

Reglas de operación y políticas comerciales

1.

Agnosticismo de producto: el portal no incorpora lógica de negocio de un plugin concreto.

2.

Identidad de producto estable: cada plugin se identifica por un pluginId estable.`;

    const out = repairSplitOrderedListItems(raw);
    assert.match(out, /1\. Agnosticismo de producto:/);
    assert.match(out, /2\. Identidad de producto estable:/);
    assert.doesNotMatch(out, /\n1\.\s*\n/);
    assert.doesNotMatch(out, /\n2\.\s*\n/);
  });

  it("fusiona número suelto sin línea en blanco intermedia", () => {
    const raw = "1.\nCoincidencia credencial-producto: una clave válida.";
    assert.equal(
      repairSplitOrderedListItems(raw),
      "1. Coincidencia credencial-producto: una clave válida.",
    );
  });

  it("no altera bloques de código", () => {
    const raw = "```sql\n1.\nSELECT 1;\n```";
    assert.equal(repairSplitOrderedListItems(raw), raw);
  });

  it("no fusiona si la siguiente línea es otro encabezado", () => {
    const raw = "1.\n## 7. Infraestructura";
    assert.equal(repairSplitOrderedListItems(raw), raw);
  });

  it("formatDocumentMarkdown aplica la reparación", () => {
    const raw = "1.\n\n**Kill Switch:** bloqueo centralizado.";
    const out = formatDocumentMarkdown(raw);
    assert.match(out, /1\. \*\*Kill Switch:\*\*/);
  });
});
