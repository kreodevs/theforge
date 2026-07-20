import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractV1InScopePantallaRoutes, resolvePantallaV1InScope } from "./ui-screens-v1-scope.util.js";

describe("ui-screens-v1-scope", () => {
  it("excludes routes under Fuera de alcance v1", () => {
    const md = `# Pantallas

## Admin
| Ruta | Página | US | API | Estados |
|------|--------|-----|-----|---------|
| /in-scope | Page | US-CRUD-ORDERS | GET /api/v1/orders | ok |

## Fuera de alcance v1
| Ruta | Página | US | API | Estados |
| /zombie | Zombie | — | fuera de alcance v1 | ok |
`;
    const routes = extractV1InScopePantallaRoutes(md);
    assert.deepEqual(routes, ["/in-scope"]);
  });

  it("resolvePantallaV1InScope requires API or hu-only with US", () => {
    assert.equal(
      resolvePantallaV1InScope({
        source: "entity+hu",
        primaryApi: "GET /api/v1/x",
        userStoryId: "US-CRUD-X",
      }),
      true,
    );
    assert.equal(
      resolvePantallaV1InScope({ source: "entity", primaryApi: undefined }),
      false,
    );
  });
});
