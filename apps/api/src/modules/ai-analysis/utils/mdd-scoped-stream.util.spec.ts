import { describe, it } from "node:test";
import assert from "node:assert";
import {
  hasSecondCanonicalMddHeading,
  invokeScopedArchitectLlmWithHeadingCap,
  trimBeforeSecondCanonicalMddHeading,
} from "./mdd-scoped-stream.util.js";

describe("mdd-scoped-stream.util", () => {
  it("hasSecondCanonicalMddHeading false con un solo heading", () => {
    assert.strictEqual(hasSecondCanonicalMddHeading("## 3. Modelo de Datos\n\nSQL aquí"), false);
  });

  it("detecta y recorta al 2º heading canónico", () => {
    const raw = `## 4. Contratos de API

GET /health

## 5. Lógica y Edge Cases

no debe quedar`;
    assert.strictEqual(hasSecondCanonicalMddHeading(raw), true);
    assert.strictEqual(
      trimBeforeSecondCanonicalMddHeading(raw),
      `## 4. Contratos de API

GET /health`,
    );
  });

  it("aborta stream colgado por inactividad y hace fallback invoke", async () => {
    const prevIdle = process.env.LANGGRAPH_LLM_IDLE_TIMEOUT_MS;
    process.env.LANGGRAPH_LLM_IDLE_TIMEOUT_MS = "50";
    try {
      let invokeCalls = 0;
      const llm = {
        stream: async function* () {
          yield { content: "## 3. Modelo de Datos\n\n" };
          await new Promise((r) => setTimeout(r, 200));
          yield { content: "CREATE TABLE t (id UUID PRIMARY KEY);" };
        },
        invoke: async () => {
          invokeCalls += 1;
          return { content: "## 3. Modelo de Datos\n\nCREATE TABLE t (id UUID PRIMARY KEY);" };
        },
      };
      const result = await invokeScopedArchitectLlmWithHeadingCap(llm, [], {
        tag: "test:scoped-idle",
        hardTimeoutMs: 5_000,
        idleTimeoutMs: 50,
      });
      assert.strictEqual(invokeCalls, 1);
      assert.match(String(extractContent(result)), /CREATE TABLE t/);
    } finally {
      if (prevIdle === undefined) delete process.env.LANGGRAPH_LLM_IDLE_TIMEOUT_MS;
      else process.env.LANGGRAPH_LLM_IDLE_TIMEOUT_MS = prevIdle;
    }
  });
});

function extractContent(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const content = (response as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
}
