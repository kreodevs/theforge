import { describe, it } from "node:test";
import assert from "node:assert";
import {
  isCollapsedDirectoryTreeLine,
  splitCollapsedDirectoryTree,
  repairDirectoryTreeBlocks,
} from "./repair-directory-tree.js";

describe("repairDirectoryTreeBlocks", () => {
  it("detecta árbol colapsado en una línea", () => {
    const line =
      "/— apps/— backend/— src/— core/— modules/— auth/— crm/— ticketing/— docker-compose.yml";
    assert.equal(isCollapsedDirectoryTreeLine(line), true);
  });

  it("parte conectores — | — en líneas separadas", () => {
    const line = "((Root)/—|— apps/—|— backend/ # NestJS —|— frontend/";
    const parts = splitCollapsedDirectoryTree(line);
    assert.ok(parts.length >= 3);
    assert.ok(parts.some((p) => p.includes("apps/")));
    assert.ok(parts.some((p) => p.includes("backend/")));
  });

  it("envuelve árbol colapsado tras encabezado en bloque text", () => {
    const raw = `### Árbol de directorios (proyecto nuevo)

/— apps/— backend/— src/— modules/— auth/— crm/— docker-compose.yml

### 2. Persistencia`;
    const out = repairDirectoryTreeBlocks(raw);
    assert.ok(out.includes("```text"));
    assert.ok(out.includes("apps/"));
    assert.ok(out.includes("\n"));
    assert.ok(!out.includes("/— apps/— backend/— src/— modules/"));
  });

  it("envuelve árbol multilínea sin fence tras encabezado", () => {
    const raw = `### Árbol de directorios

/
apps/
  backend/
  frontend/

### 2. Persistencia`;
    const out = repairDirectoryTreeBlocks(raw);
    assert.ok(out.includes("```text"));
    assert.ok(out.includes("apps/"));
    assert.ok(out.includes("backend/"));
  });
});
