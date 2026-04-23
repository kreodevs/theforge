import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  joinConstitutionSectionsForPrompt,
  sliceMddConstitutionSections,
} from "./legacy-mdd-constitution-sections.util.js";

describe("sliceMddConstitutionSections", () => {
  it("extrae §1 y §3 por encabezados ## N.", () => {
    const md = `## 1. Contexto\n\nAlpha.\n\n## 2. Stack\n\nBeta.\n\n## 3. Modelo\n\nGamma.\n`;
    const s = sliceMddConstitutionSections(md);
    assert.match(s[1]!, /Alpha/);
    assert.match(s[2]!, /Beta/);
    assert.match(s[3]!, /Gamma/);
    assert.equal(s[4]!.length, 0);
  });
});

describe("joinConstitutionSectionsForPrompt", () => {
  it("une §2 y §4 en un solo bloque", () => {
    const slices = sliceMddConstitutionSections(
      "## 2. Arquitectura\n\nX.\n\n## 4. API\n\nY.\n",
    );
    const j = joinConstitutionSectionsForPrompt(slices, [2, 4]);
    assert.match(j, /X\./);
    assert.match(j, /Y\./);
    assert.match(j, /---/);
  });
});
