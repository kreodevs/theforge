/**
 * Tests del AsyncLocalStorage que propaga el contexto de telemetría de tokens.
 * Verifica runWithTokenUsageContext y withTokenUsageContextPatch.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getActiveTokenUsageContext,
  runWithTokenUsageContext,
  withTokenUsageContextPatch,
} from "./token-usage.context.js";

describe("token-usage.context", () => {
  it("devuelve null fuera de un contexto activo", () => {
    const ctx = getActiveTokenUsageContext();
    assert.equal(ctx, null);
  });

  it("propaga el contexto dentro de runWithTokenUsageContext", async () => {
    const payload = {
      projectId: "p1",
      stageId: "s1",
      documentField: "mddContent",
      context: "initial",
    };
    const observed = await runWithTokenUsageContext(payload, async () => {
      return getActiveTokenUsageContext();
    });
    assert.deepEqual(observed, payload);
  });

  it("propaga a través de awaits", async () => {
    const payload = {
      projectId: "p2",
      documentField: "specContent",
      context: "regenerate",
    };
    const result = await runWithTokenUsageContext(payload, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return getActiveTokenUsageContext();
    });
    assert.deepEqual(result, payload);
  });

  it("restaura null al salir del contexto", async () => {
    await runWithTokenUsageContext(
      { projectId: "p3", documentField: "chat", context: "chat" },
      async () => {
        assert.ok(getActiveTokenUsageContext());
      },
    );
    assert.equal(getActiveTokenUsageContext(), null);
  });

  it("withTokenUsageContextPatch sólo aplica patch si hay contexto activo", async () => {
    const outside = await withTokenUsageContextPatch(
      { node: "auditor" },
      () => getActiveTokenUsageContext(),
    );
    assert.equal(outside, null);

    const inside = await runWithTokenUsageContext(
      { projectId: "p4", documentField: "mddContent", context: "initial" },
      async () =>
        withTokenUsageContextPatch({ node: "auditor" }, () =>
          getActiveTokenUsageContext(),
        ),
    );
    assert.equal(inside?.projectId, "p4");
    assert.equal(inside?.node, "auditor");
    assert.equal(inside?.documentField, "mddContent");
  });
});
