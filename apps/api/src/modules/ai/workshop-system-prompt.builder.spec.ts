/**
 * Contract tests — `buildWorkshopSystemPrompt` (sync vs stream).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWorkshopSystemPrompt } from "./workshop-system-prompt.builder.js";

describe("buildWorkshopSystemPrompt", () => {
  it("sync: pestaña architecture usa workshopFinDelimiterCovenant", () => {
    const prompt = buildWorkshopSystemPrompt(
      { activeTab: "architecture", intent: "direct_edit" },
      { variant: "sync", history: [], userPrompt: "actualiza stack", phase0TechDocs: null },
    );
    assert.match(prompt, /---FIN_ARCH---/);
    assert.match(prompt, /Contexto de documento activo/);
  });

  it("stream: pestaña architecture incluye instrucción OBLIGATORIO explícita", () => {
    const prompt = buildWorkshopSystemPrompt(
      { activeTab: "architecture", intent: "direct_edit" },
      { variant: "stream", history: [], userPrompt: "actualiza stack", phase0TechDocs: null },
    );
    assert.match(prompt, /OBLIGATORIO — Arquitectura/);
    assert.match(prompt, /---FIN_ARCH---/);
  });

  it("welcomeBrief usa system corto y omite delimitadores FIN_*", () => {
    const prompt = buildWorkshopSystemPrompt(
      { welcomeBrief: true, activeTab: "mdd" },
      { variant: "sync", history: [], userPrompt: "hola", phase0TechDocs: null },
    );
    assert.match(prompt, /Workshop \*\*The Forge\*\*/);
    assert.doesNotMatch(prompt, /---FIN_MDD---/);
    assert.doesNotMatch(prompt, /DOCUMENT_CHANGELOG_CHAT_INSTRUCTION/);
  });
});
