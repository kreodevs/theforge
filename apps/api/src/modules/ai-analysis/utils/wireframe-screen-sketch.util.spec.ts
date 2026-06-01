import { describe, expect, it } from "vitest";
import {
  buildBatchSketchUserPayload,
  buildSketchesCachePayloadV2,
  cacheToSketchList,
  contentDigestHash,
  extractHtmlFromLlmResponse,
  mergeWireframesMarkdownOrUseFull,
  wouldShrinkWireframesDangerously,
  matchSketchToSection,
  normalizeScreenCacheKey,
  parseBatchSketchResponse,
  parseWireframeScreensFromMarkdown,
  readSketchesCache,
  readSketchesCacheV2,
  resolveScreensToRegenerate,
  sanitizeSketchHtml,
  screenSectionHash,
  screenSectionSemanticHash,
  wireframesHasParseableScreens,
  type WireframesSketchesCachePayloadV2,
  type WireframesSketchesCachePayloadV3,
} from "./wireframe-screen-sketch.util.js";

describe("wireframe-screen-sketch.util", () => {
  const sampleSection = () => {
    const md = `## Pantalla: Login

**Descripción**: Acceso

### Wireframe

\`\`\`
┌─────┐
│ LOGO│
└─────┘
\`\`\`
`;
    return parseWireframeScreensFromMarkdown(md)[0]!;
  };

  it("parseWireframeScreensFromMarkdown extrae ASCII", () => {
    const s = sampleSection();
    expect(s.wireframeAscii).toContain("LOGO");
  });

  it("resolveScreensToRegenerate solo marca pantallas cambiadas (hash semántico)", () => {
    const section = sampleSection();
    const mddHash = contentDigestHash("mdd");
    const key = normalizeScreenCacheKey(section.screenName);
    const cache = buildSketchesCachePayloadV2(
      mddHash,
      new Map([[key, { screenName: section.screenName, html: "<html></html>" }]]),
      [section],
    );
    const same = resolveScreensToRegenerate([section], cache, mddHash, { forceAll: false });
    expect(same.toGenerate).toHaveLength(0);
    expect(same.merged.size).toBe(1);

    // Cambio cosmético del body (fuera de wireframe/descripción) → no regenera
    const cosmetic = { ...section, body: section.body + "\n<!-- comentario -->" };
    const notStale = resolveScreensToRegenerate([cosmetic], cache, mddHash, { forceAll: false });
    expect(notStale.toGenerate).toHaveLength(0);

    // Cambio real del wireframeAscii → sí regenera
    const changed = { ...section, wireframeAscii: "┌──────────┐\n│ CAMBIADO │\n└──────────┘" };
    const stale = resolveScreensToRegenerate([changed], cache, mddHash, { forceAll: false });
    expect(stale.toGenerate).toHaveLength(1);
  });

  it("screenNames regenera solo las pantallas indicadas", () => {
    const login = sampleSection();
    const dashboard = {
      ...sampleSection(),
      screenName: "Dashboard",
      body: "## Pantalla: Dashboard\n\n```\n| nav |\n```",
      wireframeAscii: "| nav | stats |",
    };
    const cache = buildSketchesCachePayloadV2(
      contentDigestHash("mdd"),
      new Map([
        [normalizeScreenCacheKey(login.screenName), { screenName: login.screenName, html: "<html>login</html>" }],
        [normalizeScreenCacheKey(dashboard.screenName), { screenName: dashboard.screenName, html: "<html>dash</html>" }],
      ]),
      [login, dashboard],
    );
    const r = resolveScreensToRegenerate([login, dashboard], cache, contentDigestHash("mdd"), {
      screenNames: ["Login"],
    });
    expect(r.toGenerate).toHaveLength(1);
    expect(r.toGenerate[0]?.screenName).toBe("Login");
    expect(r.merged.size).toBe(1);
    expect(r.merged.get(normalizeScreenCacheKey(dashboard.screenName))?.html).toContain("dash");
  });

  it("cambio de MDD NO regenera bocetos sin cambio semántico (A3)", () => {
    const section = sampleSection();
    const cache = buildSketchesCachePayloadV2(
      contentDigestHash("mdd-viejo"),
      new Map([[normalizeScreenCacheKey(section.screenName), { screenName: section.screenName, html: "<html></html>" }]]),
      [section],
    );
    // mddHash distinto pero pantalla sin cambios → preservar boceto
    const r = resolveScreensToRegenerate([section], cache, contentDigestHash("mdd-nuevo"), {
      forceAll: false,
    });
    expect(r.toGenerate).toHaveLength(0);
    expect(r.merged.size).toBe(1);
  });

  it("forceAll regenera todas ignorando caché", () => {
    const section = sampleSection();
    const mddHash = contentDigestHash("mdd");
    const cache = buildSketchesCachePayloadV2(
      mddHash,
      new Map([[normalizeScreenCacheKey(section.screenName), { screenName: section.screenName, html: "<html></html>" }]]),
      [section],
    );
    const r = resolveScreensToRegenerate([section], cache, mddHash, { forceAll: true });
    expect(r.toGenerate).toHaveLength(1);
    expect(r.merged.size).toBe(0);
  });

  it("parseBatchSketchResponse lee bloques delimitados", () => {
    const raw = `<<<SCREEN Login>>>
<!DOCTYPE html><html><body><h1>Login</h1></body></html>
<<<END>>>`;
    const parsed = parseBatchSketchResponse(raw, ["Login"]);
    expect(parsed).toHaveLength(1);
  });

  it("readSketchesCacheV2 ignora v1", () => {
    expect(readSketchesCacheV2({ v: 1, hash: "x", sketches: [] })).toBeNull();
  });

  it("readSketchesCache migra v2 a v3 preservando HTML (A2 migration)", () => {
    const section = sampleSection();
    const key = normalizeScreenCacheKey(section.screenName);
    const v2: WireframesSketchesCachePayloadV2 = {
      v: 2,
      mddHash: "abc",
      screens: {
        [key]: { screenName: section.screenName, screenHash: "old-hash", html: "<html>AI</html>" },
      },
    };
    const migrated = readSketchesCache(v2) as WireframesSketchesCachePayloadV3;
    expect(migrated.v).toBe(3);
    expect(migrated.screens[key]?.html).toBe("<html>AI</html>");
    expect(migrated.screens[key]?.screenHash).toBe(""); // legacy hit
    expect(migrated.mddHash).toBe("abc");

    // Migrated entry debe ser HIT (preservar HTML sin regenerar)
    const r = resolveScreensToRegenerate([section], migrated, "any-mdd-hash", { forceAll: false });
    expect(r.toGenerate).toHaveLength(0);
    expect(r.merged.size).toBe(1);
  });

  it("screenSectionHash es estable por body", () => {
    const a = sampleSection();
    const b = sampleSection();
    expect(screenSectionHash(a)).toBe(screenSectionHash(b));
  });

  it("screenSectionSemanticHash es estable y difiere con cambio de wireframe", () => {
    const a = sampleSection();
    const b = sampleSection();
    expect(screenSectionSemanticHash(a)).toBe(screenSectionSemanticHash(b));

    const changed = { ...a, wireframeAscii: "diferente" };
    expect(screenSectionSemanticHash(changed)).not.toBe(screenSectionSemanticHash(a));

    // Cambio cosmético del body → mismo hash semántico
    const cosmetic = { ...a, body: a.body + "\n<!-- noop -->" };
    expect(screenSectionSemanticHash(cosmetic)).toBe(screenSectionSemanticHash(a));
  });

  it("buildBatchSketchUserPayload es compacto", () => {
    const payload = buildBatchSketchUserPayload([sampleSection()]);
    expect(payload.length).toBeLessThan(600);
  });

  it("cacheToSketchList devuelve pantallas", () => {
    const section = sampleSection();
    const cache = buildSketchesCachePayloadV2(
      "mdd",
      new Map([[normalizeScreenCacheKey(section.screenName), { screenName: section.screenName, html: "<html/>" }]]),
      [section],
    );
    expect(cacheToSketchList(cache)).toHaveLength(1);
  });

  it("slugifyScreenLabel ignora negrita markdown en títulos", () => {
    expect(normalizeScreenCacheKey("**Pantalla de inicio de sesión**")).toBe(
      "pantalla de inicio de sesion",
    );
    expect(
      matchSketchToSection("**Login**", [
        { ...sampleSection(), screenName: "Login" } as ReturnType<typeof sampleSection>,
      ]),
    ).toBeDefined();
  });

  it("parseWireframeScreensFromMarkdown limpia negrita del título", () => {
    const md = `## Pantalla: **Pantalla de inicio de sesión**

**Descripción**: Acceso

### Wireframe

\`\`\`
┌─────┐
│ LOGO│
└─────┘
\`\`\`
`;
    const section = parseWireframeScreensFromMarkdown(md)[0]!;
    expect(section.screenName).toBe("Pantalla de inicio de sesión");
    expect(normalizeScreenCacheKey(section.screenName)).toBe("pantalla de inicio de sesion");
  });

  it("buildSketchesCachePayloadV2 empareja nombre corto del LLM con sección markdown", () => {
    const md = `## Pantalla: CU-01 — Login de usuario

**Descripción**: Acceso

### Wireframe

\`\`\`
┌─────┐
│ LOGO│
└─────┘
\`\`\`
`;
    const section = parseWireframeScreensFromMarkdown(md)[0]!;
    const cache = buildSketchesCachePayloadV2(
      "mdd",
      new Map([["login", { screenName: "Login", html: "<html><body>Login</body></html>" }]]),
      [section],
    );
    expect(cacheToSketchList(cache)).toHaveLength(1);
    expect(cache.screens[normalizeScreenCacheKey(section.screenName)]?.html).toContain("Login");
  });

  it("matchSketchToSection tolera prefijo CU", () => {
    const section = sampleSection();
    expect(matchSketchToSection("Login", [{ ...section, screenName: "CU-12 — Login" }])).toBeDefined();
  });

  it("matchSketchToSection empareja slug **ID** con nombre legible", () => {
    const md = `## Pantalla: Crear secreto

**ID**: \`create-secret\`

### Wireframe

\`\`\`
┌─────┐
│ form│
└─────┘
\`\`\`
`;
    const section = parseWireframeScreensFromMarkdown(md)[0]!;
    expect(matchSketchToSection("create-secret", [section])?.screenName).toBe("Crear secreto");
  });

  it("buildSketchesCachePayloadV2 no conserva bocetos huérfanos sin sección markdown", () => {
    const section = sampleSection();
    const cache = buildSketchesCachePayloadV2(
      "mdd",
      new Map([
        [normalizeScreenCacheKey(section.screenName), { screenName: section.screenName, html: "<html/>" }],
        ["create-secret", { screenName: "create-secret", html: "<html>orphan</html>" }],
      ]),
      [section],
    );
    expect(cacheToSketchList(cache)).toHaveLength(1);
    expect(cacheToSketchList(cache)[0]?.screenName).toBe("Login");
  });

  it("resolveScreensToRegenerate reutiliza caché guardada bajo slug interno (migra v2→v3)", () => {
    const md = `## Pantalla: Crear secreto

**ID**: \`create-secret\`

### Wireframe

\`\`\`
┌─────┐
│ form│
└─────┘
\`\`\`
`;
    const section = parseWireframeScreensFromMarkdown(md)[0]!;
    const mddHash = contentDigestHash("mdd");
    const orphanCacheV2: WireframesSketchesCachePayloadV2 = {
      v: 2,
      mddHash,
      screens: {
        "create-secret": {
          screenName: "create-secret",
          screenHash: screenSectionHash(section), // hash de body viejo
          html: "<html/>",
        },
      },
    };
    // En producción, el sync service llama readSketchesCache primero (migra v2→v3)
    const migrated = readSketchesCache(orphanCacheV2);
    const r = resolveScreensToRegenerate([section], migrated, mddHash, { forceAll: false });
    expect(r.toGenerate).toHaveLength(0);
    expect(r.merged.get(normalizeScreenCacheKey(section.screenName))?.html).toContain("html");
  });

  it("parseBatchSketchResponse alinea nombres distintos al esperado", () => {
    const raw = `<<<SCREEN Login>>>
<!DOCTYPE html><html><body><h1>Login</h1></body></html>
<<<END>>>`;
    const parsed = parseBatchSketchResponse(raw, ["CU-01 — Login de usuario"]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.screenName).toBe("CU-01 — Login de usuario");
  });

  it("sanitizeSketchHtml elimina scripts", () => {
    const html = '<html><body><script>alert(1)</script><p>Ok</p></body></html>';
    expect(sanitizeSketchHtml(html)).not.toContain("<script");
  });

  it("extractHtmlFromLlmResponse quita fences", () => {
    expect(extractHtmlFromLlmResponse("```html\n<!DOCTYPE html><html></html>\n```")).toContain("DOCTYPE");
  });

  it("mergeWireframesMarkdownOrUseFull conserva doc grande ante fragmento corto", () => {
    const screenA = "## Pantalla: Login\n\nDesc\n\n```\n+----+\n| OK |\n+----+\n```\n";
    const screenB = "## Pantalla: Dashboard\n\nOtra pantalla larga ".repeat(20) + "\n```\n| dash |\n```\n";
    const current = `# Wireframes\n\n${screenA}${screenB}`;
    const fragment = `# Wireframes\n\n## Pantalla: Login\n\nBotón renombrado a Entrar\n\n\`\`\`\n| Entrar |\n\`\`\`\n`;
    const merged = mergeWireframesMarkdownOrUseFull(current, fragment);
    expect(merged).toContain("Dashboard");
    expect(merged).toContain("Entrar");
    expect(merged.length).toBeGreaterThan(current.length * 0.8);
  });

  it("wouldShrinkWireframesDangerously bloquea reemplazo masivo", () => {
    const current = `# Wireframes\n\n${"## Pantalla: P\n\nx\n```\n| a |\n```\n".repeat(30)}`;
    const tiny = "# Wireframes\n\n## Pantalla: Login\n\nsolo una\n";
    expect(wouldShrinkWireframesDangerously(current, tiny)).toBe(true);
    expect(wouldShrinkWireframesDangerously(current, current)).toBe(false);
  });

  it("wireframesHasParseableScreens detecta doc truncado (solo índice)", () => {
    const indexOnly = "# Wireframes\n\n## Índice de Pantallas\n\n1. Login\n";
    const full = "## Pantalla: Login\n\n**Descripción**: x\n";
    expect(wireframesHasParseableScreens(indexOnly)).toBe(false);
    expect(wireframesHasParseableScreens(full)).toBe(true);
  });
});
