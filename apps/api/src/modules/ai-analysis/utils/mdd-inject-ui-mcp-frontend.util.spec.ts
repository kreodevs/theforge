import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildUiMcpFrontendArchitectHint,
  formatUiMcpLibraryLabel,
  injectUiMcpIntoMddFrontendSection,
} from "./mdd-inject-ui-mcp-frontend.util.js";

const MDD_WITH_UI_LIB = `# MDD

## 2. Arquitectura y Stack

### 2.1 Backend
NestJS

### 2.2 Frontend

Tecnología: React + Vite

Stack UI:

    Framework: React con TypeScript
    UI Library: Tailwind CSS + Radix UI components

## 3. Modelo de Datos
`;

describe("injectUiMcpIntoMddFrontendSection", () => {
  it("append MCP a UI Library existente", () => {
    const out = injectUiMcpIntoMddFrontendSection(MDD_WITH_UI_LIB, "Kreo UI 5.3");
    assert.match(out, /UI Library: Tailwind CSS \+ Radix UI components \+ Kreo UI 5\.3/);
  });

  it("es idempotente si el label ya está", () => {
    const once = injectUiMcpIntoMddFrontendSection(MDD_WITH_UI_LIB, "Kreo UI");
    const twice = injectUiMcpIntoMddFrontendSection(once, "Kreo UI");
    assert.equal(once, twice);
  });

  it("añade UI Library bajo Stack UI si falta la línea", () => {
    const mdd = `## 2. Arquitectura y Stack

### 2.2 Frontend

Stack UI:

    Framework: React
`;
    const out = injectUiMcpIntoMddFrontendSection(mdd, "@imj_media/ui");
    assert.match(out, /UI Library: @imj_media\/ui/);
  });
});

describe("formatUiMcpLibraryLabel", () => {
  it("combina nombre y versión", () => {
    assert.equal(
      formatUiMcpLibraryLabel({ libraryName: "Kreo UI", libraryVersion: "5.3.0" }),
      "Kreo UI 5.3.0",
    );
  });
});

describe("buildUiMcpFrontendArchitectHint", () => {
  it("menciona UI Library y el label", () => {
    const hint = buildUiMcpFrontendArchitectHint("Kreo UI");
    assert.match(hint, /UI Library/);
    assert.match(hint, /Kreo UI/);
  });
});
