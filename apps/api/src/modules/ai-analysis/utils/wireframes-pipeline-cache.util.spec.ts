import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWireframesPipelineCache,
  readWireframesPipelineCache,
  reconstructScreensFromWireframes,
  resolveReusableScreens,
  wireframesInputsHash,
} from "./wireframes-pipeline-cache.util.js";

test("wireframesInputsHash — estable para mismos insumos", () => {
  const a = wireframesInputsHash("casos", "hu");
  const b = wireframesInputsHash("casos", "hu");
  assert.equal(a, b);
  assert.notEqual(a, wireframesInputsHash("otros", "hu"));
});

test("readWireframesPipelineCache — roundtrip", () => {
  const cache = buildWireframesPipelineCache("hash1", [
    {
      id: "login",
      name: "Login",
      description: "Acceso",
      sourceUseCases: ["CU-01"],
      sourceUserStories: ["HU-01"],
      requiredComponents: ["Button", "Input"],
      navigationFlow: [],
    },
  ]);
  const read = readWireframesPipelineCache(cache);
  assert.deepEqual(read?.screens[0]?.id, "login");
});

test("reconstructScreensFromWireframes — extrae ID y componentes", () => {
  const md = `# Wireframes

## Pantalla: Login

**ID**: \`login\`
**Descripción**: Pantalla de acceso

### Wireframe
\`\`\`
+------+
|  OK  |
+------+
\`\`\`
`;
  const mappings = [
    {
      screenId: "login",
      requiredComponent: "Button",
      mcpModuleId: "Button",
      matchConfidence: "exact" as const,
    },
    {
      screenId: "login",
      requiredComponent: "Input",
      mcpModuleId: "Input",
      matchConfidence: "exact" as const,
    },
  ];
  const screens = reconstructScreensFromWireframes(md, mappings);
  assert.equal(screens.length, 1);
  assert.equal(screens[0].id, "login");
  assert.deepEqual(screens[0].requiredComponents, ["Button", "Input"]);
});

test("resolveReusableScreens — fallback desde mappings sin markdown", () => {
  const mappings = [
    { screenId: "login", requiredComponent: "Button", matchConfidence: "exact" as const },
    { screenId: "login", requiredComponent: "Input", matchConfidence: "exact" as const },
    { screenId: "dashboard", requiredComponent: "Table", matchConfidence: "exact" as const },
  ];
  const resolved = resolveReusableScreens({
    inputsHash: "any",
    cache: null,
    wireframesMarkdown: "",
    componentMappings: mappings,
  });
  assert.equal(resolved?.length, 2);
  assert.deepEqual(resolved?.find((s) => s.id === "login")?.requiredComponents, ["Button", "Input"]);
});

test("resolveReusableScreens — prefiere caché cuando hash coincide", () => {
  const inputsHash = wireframesInputsHash("c", "h");
  const cache = buildWireframesPipelineCache(inputsHash, [
    {
      id: "dash",
      name: "Dashboard",
      description: "",
      sourceUseCases: [],
      sourceUserStories: [],
      requiredComponents: ["Table"],
      navigationFlow: [],
    },
  ]);
  const resolved = resolveReusableScreens({
    inputsHash,
    cache,
    wireframesMarkdown: "",
    componentMappings: [],
  });
  assert.equal(resolved?.[0]?.id, "dash");
});
