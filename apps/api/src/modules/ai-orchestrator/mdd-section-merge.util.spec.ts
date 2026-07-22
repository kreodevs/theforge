import { describe, expect, it } from "vitest";
import { mergeMddBySection, parseMddBySection } from "./mdd-section-merge.util.js";

describe("parseMddBySection", () => {
  it("devuelve front matter + secciones para un MDD estándar", () => {
    const md = `# Master Design Document — Foo

> intro
---

## 1. Contexto
texto contexto

## 2. Stack
texto stack
`;
    const r = parseMddBySection(md);
    expect(r.sections.map((s) => s.heading)).toEqual(["## 1. Contexto", "## 2. Stack"]);
    expect(r.frontMatter).toContain("# Master Design Document");
  });

  it("ignora ## dentro de code fences", () => {
    const md = `## 1. Real
\`\`\`
## 2. Falso (dentro de fence)
\`\`\`

## 3. Real otra vez
`;
    const r = parseMddBySection(md);
    expect(r.sections.map((s) => s.heading)).toEqual(["## 1. Real", "## 3. Real otra vez"]);
  });

  it("ignora ## que no estén numerados", () => {
    const md = `## Sin número
## 1. Con número
`;
    const r = parseMddBySection(md);
    expect(r.sections.map((s) => s.heading)).toEqual(["## 1. Con número"]);
  });

  it("devuelve empty si no hay secciones", () => {
    expect(parseMddBySection("solo front matter\nsin headings").sections).toEqual([]);
  });

  it("tolera null/undefined", () => {
    expect(parseMddBySection(null).sections).toEqual([]);
    expect(parseMddBySection(undefined).sections).toEqual([]);
  });
});

describe("mergeMddBySection", () => {
  const fullMdd = `# MDD — Test

---

## 1. Contexto
Lorem ipsum §1 contenido largo con muchos detalles que no se deben perder al hacer merge.
Más texto §1 para que tenga tamaño suficiente y dispare la heurística de truncado.

## 2. Stack
Backend: NestJS
Frontend: React

## 3. Modelo de Datos
Tabla tenants
Tabla licenses

## 4. Contratos de API
GET /health
POST /tenants

## 5. Seguridad
Argon2id
JWT RS256
`;

  it("si incoming está vacío, devuelve existing sin cambios", () => {
    const r = mergeMddBySection(fullMdd, "");
    expect(r.content).toBe(fullMdd);
    expect(r.stats.mode).toBe("keep-existing");
    expect(r.stats.noChange).toBe(true);
  });

  it("si existing está vacío, incoming es el primer write", () => {
    const incoming = "## 1. Hola\nmundo\n";
    const r = mergeMddBySection("", incoming);
    expect(r.stats.mode).toBe("first-write");
    expect(r.content).toContain("## 1. Hola");
  });

  it("regeneración de una sola sección preserva el resto", () => {
    const incoming = `## 4. Contratos de API
GET /health
POST /tenants
POST /licenses
PATCH /licenses/:id
DELETE /licenses/:id
más detalle`;

    const r = mergeMddBySection(fullMdd, incoming);
    expect(r.stats.sectionsReplaced).toEqual(["## 4. Contratos de API"]);
    expect(r.stats.sectionsKept).toContain("## 1. Contexto");
    expect(r.stats.sectionsKept).toContain("## 2. Stack");
    expect(r.stats.sectionsKept).toContain("## 3. Modelo de Datos");
    expect(r.stats.sectionsKept).toContain("## 5. Seguridad");
    expect(r.content).toContain("POST /licenses");
    expect(r.content).toContain("Argon2id"); // §5 preserved
    expect(r.content).toContain("## 1. Contexto");
  });

  it("regeneración completa limpia cubre todas las secciones → full-replace", () => {
    const incoming = `# MDD — Test (regenerado)

---

## 1. Contexto
nuevo §1

## 2. Stack
nuevo §2

## 3. Modelo de Datos
nuevo §3

## 4. Contratos de API
nuevo §4

## 5. Seguridad
nuevo §5
`;
    const r = mergeMddBySection(fullMdd, incoming);
    expect(r.stats.mode).toBe("full-replace");
    expect(r.content).toContain("regenerado");
  });

  it("regeneración truncada (sólo §1, §2) NO destruye §3-§5", () => {
    const incoming = `# MDD — Test (intentando regenerar, truncado)

## 1. Contexto
nuevo §1 un poco más largo

## 2. Stack
nuevo §2
`;
    const r = mergeMddBySection(fullMdd, incoming);
    expect(r.stats.truncatedIncoming).toBe(true);
    expect(r.stats.mode).toBe("section-merge");
    expect(r.content).toContain("Tabla tenants"); // §3 preservado
    expect(r.content).toContain("Argon2id");      // §5 preservado
    expect(r.content).toContain("nuevo §1");
  });

  it("incoming con sección placeholder vacía no pisa la buena existente", () => {
    const incoming = `## 4. Contratos de API

`;
    const r = mergeMddBySection(fullMdd, incoming);
    expect(r.stats.sectionsKept).toContain("## 4. Contratos de API");
    expect(r.content).toContain("GET /health"); // contenido original preservado
  });

  it("incoming con sección nueva (no existía) la añade al final", () => {
    const incoming = `## 6. Anexos
nuevo anexo
mucho contenido para no considerarlo truncado
y más detalle para alcanzar tamaño razonable`;
    const r = mergeMddBySection(fullMdd, incoming);
    expect(r.stats.sectionsAdded).toEqual(["## 6. Anexos"]);
    expect(r.content).toContain("## 6. Anexos");
    expect(r.content.indexOf("## 6. Anexos")).toBeGreaterThan(r.content.indexOf("## 5. Seguridad"));
  });

  it("preserva el front matter de incoming si lo trae", () => {
    const incoming = `# MDD totalmente nuevo

## 1. Contexto
x
## 2. Stack
x
## 3. Modelo de Datos
x
## 4. Contratos de API
x
## 5. Seguridad
x
`;
    const r = mergeMddBySection(fullMdd, incoming);
    expect(r.content).toContain("# MDD totalmente nuevo");
  });
});
