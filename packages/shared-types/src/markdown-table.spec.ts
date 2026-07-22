import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { repairCollapsedPipeTables } from "./markdown-table.js";

describe("repairCollapsedPipeTables", () => {
  it("expande tabla de dolores en una sola línea", () => {
    const raw =
      "| Dolor | Quién lo siente | Impacto | Workaround actual | | :--- | :--- | :--- | :--- | | Fragmentación de información | Usuarios Autorizados | Baja productividad | Consulta manual |";
    const out = repairCollapsedPipeTables(raw);
    const lines = out.split("\n").filter((l) => l.includes("|"));
    assert.ok(lines.length >= 3, out);
    assert.match(lines[0]!, /Dolor/);
    assert.match(lines[1]!, /:?-{3,}/);
    assert.match(lines[2]!, /Fragmentación/);
  });
});
