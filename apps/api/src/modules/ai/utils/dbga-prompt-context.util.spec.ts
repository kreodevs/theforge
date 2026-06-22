import { describe, it } from "node:test";
import assert from "node:assert";
import {
  sanitizeSourceDocForBrdPrompt,
  truncateSourceDocForBrdPrompt,
} from "./dbga-prompt-context.util.js";

describe("sanitizeSourceDocForBrdPrompt", () => {
  it("elimina bloques thinking y líneas Press Reply", () => {
    const raw = `## DBGA\n<thinking>secret</thinking>\nPress Reply to continue\n\nContenido real.`;
    const out = sanitizeSourceDocForBrdPrompt(raw);
    assert.ok(!out.includes("thinking"));
    assert.ok(!out.toLowerCase().includes("press reply"));
    assert.ok(out.includes("Contenido real"));
  });
});

describe("truncateSourceDocForBrdPrompt", () => {
  it("devuelve el documento sanitizado completo", () => {
    const long = "INICIO-" + "x".repeat(60_000) + "-FIN";
    const { text, truncated } = truncateSourceDocForBrdPrompt(long, 10_000);
    assert.equal(truncated, false);
    assert.equal(text, long);
  });
});
