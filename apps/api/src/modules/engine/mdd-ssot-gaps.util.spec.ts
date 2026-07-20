import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkBrdDecisionLogClosure } from "./brd-decision-log.util.js";
import { unifyApiContractsPrefix } from "./api-prefix-unify.util.js";
import { buildEntityApiTraceReport } from "./entity-api-trace.util.js";

describe("brd-decision-log.util", () => {
  it("blocks unresolved fiscal placeholder outside decision log", () => {
    const brd = `
## 1. Contexto
Impuesto fiscal % sin dato.

## Pendientes de validación (decision log)
| Tema | Estado | Dueño | Impacto | Plazo |
|------|--------|-------|---------|-------|
`;
    const r = checkBrdDecisionLogClosure(brd);
    assert.ok(r.blockers.length > 0 || r.warnings.length > 0);
  });
});

describe("api-prefix-unify.util", () => {
  it("promotes /api/ routes to /api/v1 when MDD declares v1", () => {
    const mdd = "## 4. API\n| GET | /api/v1/users | list |\napi_prefix: \"/api/v1\"";
    const api = "| GET | `/api/users` | list |";
    const { content, changes } = unifyApiContractsPrefix(mdd, api);
    assert.match(content, /\/api\/v1\/users/);
    assert.ok(changes.length > 0);
  });
});

describe("entity-api-trace.util", () => {
  it("reports entity without API endpoint", () => {
    const mdd = "## 3\n```sql\nCREATE TABLE watchlists (id UUID);\n```";
    const api = "| GET | /api/v1/users | |";
    const report = buildEntityApiTraceReport({
      mddMarkdown: mdd,
      inventory: { suggestedEntities: ["watchlists", "users"], capabilities: [], processes: [], crudMatrix: [], adminSurfaces: [] },
      apiContractsMarkdown: api,
    });
    assert.ok(report.gaps.some((g) => g.includes("watchlists")));
  });
});
