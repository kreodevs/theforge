import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAllPromptIniciales,
  buildPromptInicialForTarget,
} from "./governance-prompt-inicial.js";
import type { ProjectGovernanceFacts } from "./suggest-agent-governance-artifacts.js";

const baseFacts: ProjectGovernanceFacts = {
  projectTitle: "Demo",
  docPaths: ["docs/sdd/mdd.md"],
  taskHeadings: ["Setup"],
  taskCheckboxes: ["- [ ] Setup"],
  architectureLayers: [],
  blueprintModules: [],
  backendGlobs: [],
  frontendGlobs: [],
  npmScripts: [],
  sddConflicts: [],
  hasUiSurface: false,
};

describe("governance-prompt-inicial", () => {
  it("buildAllPromptIniciales incluye índice + 7 variantes", () => {
    const files = buildAllPromptIniciales(baseFacts, "LOW");
    const paths = files.map((f) => f.path);
    assert.ok(paths.includes("PROMPT-INICIAL.md"));
    assert.ok(paths.includes("PROMPT-INICIAL.cursor.md"));
    assert.ok(paths.includes("PROMPT-INICIAL.antigravity.md"));
    assert.ok(paths.includes("PROMPT-INICIAL.codex.md"));
    assert.equal(paths.filter((p) => /^PROMPT-INICIAL\.[a-z0-9-]+\.md$/.test(p)).length, 7);
  });

  it("Antigravity prompt no menciona .cursor ni Cursor", () => {
    const md = buildPromptInicialForTarget("antigravity", baseFacts, "LOW");
    assert.equal(/\`.cursor\`/i.test(md), false);
    assert.equal(/\.cursor\//i.test(md), false);
    assert.equal(/\bCursor\b/.test(md), false);
    assert.ok(md.includes("install-governance-antigravity.sh"));
    assert.ok(md.includes(".agents/skills"));
  });

  it("Cursor prompt no menciona .agents ni Antigravity", () => {
    const md = buildPromptInicialForTarget("cursor", baseFacts, "LOW");
    assert.equal(/\.agents\//i.test(md), false);
    assert.equal(/\bAntigravity\b/i.test(md), false);
    assert.ok(md.includes("install-governance-cursor.sh"));
    assert.ok(md.includes(".cursor/rules"));
  });

  it("Codex omite scripts IDE-specific en paso 1", () => {
    const md = buildPromptInicialForTarget("codex", baseFacts, "LOW");
    assert.equal(/install-governance-cursor/i.test(md), false);
    assert.ok(md.includes("AGENTS.md"));
  });
});
