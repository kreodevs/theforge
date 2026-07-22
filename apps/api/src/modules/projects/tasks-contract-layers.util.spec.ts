import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractTasksContractManifest,
  matchBusinessRulesForStory,
  matchEndpointsForStory,
} from "./tasks-contract-layers.util.js";
import {
  buildTasksContextAnchors,
  partitionPlanItemsByGenerationLayer,
} from "./tasks-context-anchor.util.js";
import { buildTasksLayerPromptContext } from "./tasks-layer-context.util.js";

const SAMPLE_MDD = `
## 1. Contexto

### Glosario de dominio (Ubiquitous Language)
- **Usuario:** persona autenticada del sistema.
- **Token:** credencial JWT de sesión.

### Bloqueantes de negocio
- El token expira en 15 minutos
- Requiere validación de dominio según MDD v2

## 2. Stack
**Frontend:** React **Backend:** NestJS

## 3. Modelo de datos
- users (email UNIQUE)

## 4. Contratos API
POST /api/v1/auth/login

## 5. Lógica y Edge Cases
- Dado credenciales válidas Cuando login Entonces emite JWT
`;

const SAMPLE_HU = `
### Historia de usuario: [US-102] Autenticación de Usuarios
**Como:** usuario
**Quiero:** iniciar sesión con email
**Para:** acceder al dashboard

**Criterios de aceptación**
- El token expira en 15 minutos
- Validar dominio corporativo
`;

const SAMPLE_API = `
| POST | \`/api/v1/auth/login\` | Login |
`;

const SAMPLE_UI = `
| Ruta | Pantalla | HU | Componente | API | Estados |
| /login | LoginPage | US-102 | LoginForm | POST /api/v1/auth/login | loading, error |
`;

function anchorsFromManifest(manifest: ReturnType<typeof extractTasksContractManifest>) {
  return buildTasksContextAnchors(manifest);
}

describe("tasks-contract-layers", () => {
  it("extrae manifiesto con 4 capas", () => {
    const manifest = extractTasksContractManifest({
      mddMarkdown: SAMPLE_MDD,
      userStoriesMarkdown: SAMPLE_HU,
      apiContractsMarkdown: SAMPLE_API,
      uiScreensMarkdown: SAMPLE_UI,
      blueprintMarkdown: "## Fase 1\n- Clean Architecture",
    });
    assert.equal(manifest.version, 1);
    assert.equal(manifest.layers.length, 4);
    const domain = manifest.layers.find((l) => l.layer === "domain");
    assert.ok(domain!.glossary.length >= 1);
    assert.ok(
      domain!.businessRules.length >= 1 ||
        anchorsFromManifest(manifest).some((a) => a.business_rules.length > 0),
    );
    const integration = manifest.layers.find((l) => l.layer === "integration");
    assert.equal(integration!.endpoints.length, 1);
    assert.equal(integration!.endpoints[0]!.path, "/api/v1/auth/login");
  });

  it("construye context anchor por HU", () => {
    const manifest = extractTasksContractManifest({
      mddMarkdown: SAMPLE_MDD,
      userStoriesMarkdown: SAMPLE_HU,
      apiContractsMarkdown: SAMPLE_API,
      uiScreensMarkdown: SAMPLE_UI,
    });
    const anchors = buildTasksContextAnchors(manifest);
    assert.equal(anchors.length, 1);
    assert.equal(anchors[0]!.story_id, "US-102");
    assert.equal(anchors[0]!.feature, "Autenticación de Usuarios");
    assert.ok(anchors[0]!.contracts.endpoints.includes("POST /api/v1/auth/login"));
    assert.ok(anchors[0]!.contracts.screens.includes("/login"));
  });

  it("matriz de contexto mínimo por capa Backend", () => {
    const manifest = extractTasksContractManifest({
      mddMarkdown: SAMPLE_MDD,
      userStoriesMarkdown: SAMPLE_HU,
      apiContractsMarkdown: SAMPLE_API,
      uiScreensMarkdown: SAMPLE_UI,
    });
    const ctx = buildTasksLayerPromptContext({
      manifest,
      layer: "Backend",
      anchors: buildTasksContextAnchors(manifest),
      mddMarkdown: SAMPLE_MDD,
      specMarkdown: "## Reglas\n- JWT obligatorio",
    });
    assert.match(ctx, /Manifiesto de contratos/);
    assert.match(ctx, /Context Anchors/);
    assert.doesNotMatch(ctx, /Design System \(fallback\)/);
  });

  it("particiona plan por capa de generación", () => {
    const map = partitionPlanItemsByGenerationLayer([
      {
        id: "T-001",
        title: "API login",
        layer: "Backend",
        mddRefs: [],
        storyRefs: [],
        upstreamRefs: [],
        dependsOn: [],
        targetFilesHint: [],
      },
      {
        id: "T-002",
        title: "UI login",
        layer: "Frontend",
        mddRefs: [],
        storyRefs: ["US-102"],
        upstreamRefs: [],
        dependsOn: [],
        targetFilesHint: [],
      },
    ]);
    assert.equal(map.get("Backend")?.length, 1);
    assert.equal(map.get("Frontend")?.length, 1);
  });

  it("match endpoints y reglas para story", () => {
    const manifest = extractTasksContractManifest({
      mddMarkdown: SAMPLE_MDD,
      userStoriesMarkdown: SAMPLE_HU,
      apiContractsMarkdown: SAMPLE_API,
      uiScreensMarkdown: SAMPLE_UI,
    });
    const story = manifest.layers.find((l) => l.layer === "domain")!.userStories[0]!;
    const endpoints = manifest.layers.find((l) => l.layer === "integration")!.endpoints;
    const screens = manifest.layers.find((l) => l.layer === "experience")!.screens;
    const matched = matchEndpointsForStory(story, screens, endpoints);
    assert.ok(matched.some((e) => e.path === "/api/v1/auth/login"));
    const rules = matchBusinessRulesForStory(
      story,
      manifest.layers.find((l) => l.layer === "domain")!.businessRules,
      manifest.layers.find((l) => l.layer === "domain")!.glossary,
    );
    assert.ok(rules.some((r) => r.includes("15 minutos")));
  });
});
