import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deduplicateDbgaDocument,
  hasDuplicateDbgaBlocks,
} from "./deduplicate-dbga-document.js";
import { formatDocumentMarkdown } from "./format-document-markdown.js";

describe("deduplicateDbgaDocument", () => {
  it("detecta bloques duplicados", () => {
    const raw = "# Domain Benchmark & Gap Analysis\n\n## 1. A\n\n# Domain Benchmark & Gap Analysis\n\n## 1. B";
    assert.equal(hasDuplicateDbgaBlocks(raw), true);
  });

  it("detecta §1 repetida sin repetir el H1", () => {
    const raw = [
      "# Domain Benchmark & Gap Analysis",
      "",
      "## 1. Propósito y Alcance",
      "",
      "Versión A.",
      "",
      "## 1. Propósito y Alcance",
      "",
      "Versión B con más detalle y longitud suficiente para no truncar.",
    ].join("\n");
    assert.equal(hasDuplicateDbgaBlocks(raw), true);
  });

  it("no deduplica MDD u otros documentos sin forma DBGA", () => {
    const mdd = "# Master Design Document\n\n## 1. Contexto\n\n## 1. Contexto\n\nFoo";
    assert.equal(hasDuplicateDbgaBlocks(mdd), false);
  });

  it("formatDocumentMarkdown deduplica antes de normalizar tablas y fences", () => {
    const raw = [
      "# Domain Benchmark & Gap Analysis",
      "",
      "## 3. Reglas de Negocio",
      "",
      "- Regla incompleta",
      "",
      "# Domain Benchmark & Gap Analysis",
      "",
      "## 3. Reglas de Negocio",
      "",
      "- Regla completa con suficiente detalle para pasar el filtro de truncado.",
    ].join("\n");
    const out = formatDocumentMarkdown(raw);
    assert.equal((out.match(/^# Domain Benchmark/gm) ?? []).length, 1);
    assert.match(out, /Regla completa/);
    assert.doesNotMatch(out, /Regla incompleta/);
  });

  it("conserva la sección más completa por número", () => {
    const short = "## 3. Reglas de Negocio\n\n- Regla corta.";
    const long =
      "## 3. Reglas de Negocio\n\n- Regla completa con detalle suficiente para no parecer truncada.";
    const raw = [
      "# Domain Benchmark & Gap Analysis",
      "",
      "## Referencia de Industria",
      "",
      "Wasender y Bitrix.",
      "",
      short,
      "",
      "# Domain Benchmark & Gap Analysis",
      "",
      "## Referencia de Industria",
      "",
      "Wasender y Bitrix.",
      "",
      long,
    ].join("\n");

    const out = deduplicateDbgaDocument(raw);
    assert.equal((out.match(/^# Domain Benchmark/gm) ?? []).length, 1);
    assert.match(out, /Regla completa/);
    assert.doesNotMatch(out, /Regla corta/);
  });

  it("fusiona changelog por versión y elimina basura posterior a la tabla", () => {
    const raw = [
      "# Domain Benchmark & Gap Analysis",
      "",
      "## 1. Propósito y Alcance",
      "",
      "**Problema:** Copiloto centralizado para usuarios autorizados del grupo.",
      "",
      "## Registro de cambios del documento",
      "",
      "| Versión | Fecha | Descripción del cambio |",
      "| --- | --- | --- |",
      "| 1.0 | Mayo 2026 | Creación inicial |",
      "",
      "## 2. Entidades del Dominio",
      "",
      "Duplicado incrustado tras la tabla de changelog.",
      "",
      "# Domain Benchmark & Gap Analysis",
      "",
      "## 2. Entidades del Dominio",
      "",
      "### Tenant",
      "",
      "Versión canónica de entidades.",
      "",
      "## Registro de cambios del documento",
      "",
      "| Versión | Fecha | Descripción del cambio |",
      "| --- | --- | --- |",
      "| 1.1 | Junio 2026 | Añadido multi-agente |",
    ].join("\n");

    const out = deduplicateDbgaDocument(raw);
    assert.match(out, /\| 1\.0 \| Mayo 2026 \| Creación inicial \|/);
    assert.match(out, /\| 1\.1 \| Junio 2026 \| Añadido multi-agente \|/);
    assert.doesNotMatch(out, /Duplicado incrustado/);
    assert.match(out, /Versión canónica de entidades/);
    assert.equal((out.match(/^## 2\. Entidades/gm) ?? []).length, 1);
  });
});
