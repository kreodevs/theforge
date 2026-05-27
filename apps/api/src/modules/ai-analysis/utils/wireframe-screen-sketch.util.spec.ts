import { describe, expect, it } from "vitest";
import {
  buildBatchSketchUserPayload,
  buildSketchesCachePayloadV2,
  cacheToSketchList,
  contentDigestHash,
  extractHtmlFromLlmResponse,
  matchSketchToSection,
  normalizeScreenCacheKey,
  parseBatchSketchResponse,
  parseWireframeScreensFromMarkdown,
  readSketchesCacheV2,
  resolveScreensToRegenerate,
  sanitizeSketchHtml,
  screenSectionHash,
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

  it("resolveScreensToRegenerate solo marca pantallas cambiadas", () => {
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

    const changed = { ...section, body: section.body + "\n**Nuevo**" };
    const stale = resolveScreensToRegenerate([changed], cache, mddHash, { forceAll: false });
    expect(stale.toGenerate).toHaveLength(1);
  });

  it("cambio de MDD regenera todas", () => {
    const section = sampleSection();
    const cache = buildSketchesCachePayloadV2(
      contentDigestHash("mdd-viejo"),
      new Map([[normalizeScreenCacheKey(section.screenName), { screenName: section.screenName, html: "<html></html>" }]]),
      [section],
    );
    const r = resolveScreensToRegenerate([section], cache, contentDigestHash("mdd-nuevo"), {
      forceAll: false,
    });
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

  it("screenSectionHash es estable por body", () => {
    const a = sampleSection();
    const b = sampleSection();
    expect(screenSectionHash(a)).toBe(screenSectionHash(b));
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
});
