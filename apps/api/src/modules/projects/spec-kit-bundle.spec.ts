import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSpecKitBundleFiles,
  buildSddImplementReadme,
  parseTasksMarkdown,
  slugifySpecKitFeature,
  specKitFeatureDir,
} from "@theforge/shared-types";

describe("spec-kit-bundle", () => {
  it("slugifySpecKitFeature normaliza nombre", () => {
    assert.equal(slugifySpecKitFeature("Mi App SDD"), "mi-app-sdd");
  });

  it("buildSpecKitBundleFiles separa ui-project.json embebido", () => {
    const files = buildSpecKitBundleFiles({
      projectName: "Taskify",
      mddContent: "# MDD",
      uiScreensContent: "# Pantallas\n\n---UI_PROJECT_JSON---\n{\"version\":\"1.0.0\"}\n",
    });
    const pantallas = files.find((f) => f.path.endsWith("pantallas.md"));
    const uiProject = files.find((f) => f.path.endsWith("ui-project.json"));
    assert.ok(pantallas?.content.includes("# Pantallas"));
    assert.ok(!pantallas?.content.includes("UI_PROJECT_JSON"));
    assert.ok(uiProject?.content.includes('"version":"1.0.0"') || uiProject?.content.includes('"version": "1.0.0"'));
  });

  it("buildSpecKitBundleFiles exporta tasks-json.json cuando hay tasksJson", () => {
    const files = buildSpecKitBundleFiles({
      projectName: "Demo",
      mddContent: "# MDD",
      tasksContent: "- [ ] T-001 legacy",
      tasksJson: { version: "2.0", tasks: [{ id: "T-001", title: "SSOT" }] },
    });
    const jsonFile = files.find((f) => f.path.endsWith("tasks-json.json"));
    assert.ok(jsonFile);
    assert.match(jsonFile!.content, /T-001/);
  });

  it("buildSpecKitBundleFiles crea layout spec-kit", () => {
    const files = buildSpecKitBundleFiles({
      projectName: "Taskify",
      mddContent: "# MDD\n\n## 3. Modelo\n\nTabla users",
      specContent: "# Spec",
      blueprintContent: "# Plan",
      tasksContent: "- [ ] Implementar login",
      architectureContent: "# Arch",
      useCasesContent: "# UC",
      userStoriesContent: "# US",
      uiScreensContent: "# Pantallas\n",
    });
    const paths = files.map((f) => f.path);
    assert.ok(paths.includes(".specify/memory/constitution.md"));
    assert.ok(paths.some((p) => p.startsWith("specs/001-taskify/spec.md")));
    assert.ok(paths.some((p) => p.endsWith("architecture.md")));
    assert.ok(paths.some((p) => p.endsWith("use-cases.md")));
    assert.ok(paths.some((p) => p.endsWith("user-stories.md")));
    assert.ok(paths.some((p) => p.endsWith("pantallas.md")));
    assert.ok(paths.some((p) => p.endsWith("data-model.md")));
    assert.ok(paths.includes("IMPLEMENT.md"));
  });

  it("IMPLEMENT.md incluye path map resuelto y relación con gobernanza", () => {
    const featureDir = specKitFeatureDir(1, "Demo");
    const files = buildSpecKitBundleFiles({
      projectName: "Demo",
      mddContent: "# MDD",
    });
    const implement = files.find((f) => f.path === "IMPLEMENT.md");
    assert.ok(implement?.content.includes("Path map"));
    assert.ok(implement?.content.includes(".specify/memory/constitution.md"));
    assert.ok(implement?.content.includes("docs/sdd/mdd.md"));
    assert.ok(implement?.content.includes(`${featureDir}/spec.md`));
    assert.ok(implement?.content.includes(`${featureDir}/tasks.md`));
    assert.ok(!implement?.content.includes("{featureDir}"));
    assert.ok(!implement?.content.includes("specs/NNN-slug"));
    assert.ok(implement?.content.includes("mirror"));
    assert.ok(implement?.content.includes("docs/agent-governance"));
    assert.ok(implement?.content.includes("Agent — first terminal action"));
    assert.ok(implement?.content.includes("install-agent-governance.sh"));
    assert.equal(implement?.content, buildSddImplementReadme(featureDir));
  });

  it("specKitFeatureDir usa ordinal", () => {
    assert.equal(specKitFeatureDir(2, "Foo"), "specs/002-foo");
  });

  it("quickstart.md incluye arranque local y smoke desde tasks", () => {
    const files = buildSpecKitBundleFiles({
      projectName: "Peludo",
      mddContent: "## 2. Arquitectura y Stack\nBackend Fastify. Deploy Railway.\nGET /health",
      blueprintContent: "## Plan\nUsar pnpm dev.",
      apiContractsContent: "### Health\nGET /api/v1/health — readiness",
      tasksContent:
        "## US-1 Auth\n**Checkpoint**: login smoke\n- [ ] [P] Implementar POST /auth/login\n- [ ] Verificar GET /health",
      specContent: "# Spec\nCriterio de éxito: login funcional.",
    });
    const quickstart = files.find((f) => f.path.endsWith("quickstart.md"));
    assert.ok(quickstart);
    assert.match(quickstart!.content, /## Arranque local/);
    assert.match(quickstart!.content, /pnpm install/);
    assert.match(quickstart!.content, /Checkpoint: login smoke/);
    assert.match(quickstart!.content, /\/api\/v1\/health/);
    assert.doesNotMatch(quickstart!.content, /GET `\/health`/);
    assert.match(quickstart!.content, /## Referencias/);
    assert.ok(quickstart!.content.split("\n").length > 12);
  });

  it("quickstart.md limita checkpoints y limpia marcadores **", () => {
    const checkpoints = Array.from({ length: 20 }, (_, i) => {
      const n = i + 1;
      const label =
        n === 1
          ? "Auth JWT válido"
          : n === 5
            ? "GET /api/v1/health responde 200"
            : `Flujo secundario ${n}`;
      return `## US-${n}\n**Checkpoint**: ${label}\n- [ ] tarea ${n}`;
    }).join("\n");
    const files = buildSpecKitBundleFiles({
      projectName: "Peludo",
      mddContent: "## 2. Stack\nMonorepo pnpm.",
      tasksContent: checkpoints,
    });
    const quickstart = files.find((f) => f.path.endsWith("quickstart.md"))!.content;
    const smokeLines = quickstart.split("\n").filter((l) => l.startsWith("- [ ] Checkpoint:"));
    assert.ok(smokeLines.length >= 2);
    assert.ok(smokeLines.length <= 12);
    assert.match(quickstart, /Checkpoint: Auth JWT válido/);
    assert.match(quickstart, /Checkpoint: GET \/api\/v1\/health responde 200/);
    assert.doesNotMatch(quickstart, /Checkpoint:\s*\*\*/);
  });

  it("quickstart.md usa pnpm por defecto si MDD §2 no menciona gestor", () => {
    const files = buildSpecKitBundleFiles({
      projectName: "Peludo",
      mddContent: "## 2. Stack\nBackend Fastify en Railway.",
      tasksContent: "**Checkpoint:** smoke MVP\n- [ ] init",
    });
    const quickstart = files.find((f) => f.path.endsWith("quickstart.md"))!.content;
    assert.match(quickstart, /pnpm install/);
    assert.match(quickstart, /Checkpoint: smoke MVP/);
    assert.doesNotMatch(quickstart, /Checkpoint:\s*\*/);
  });

  it("quickstart.md excluye encabezados de spec y notas de ambigüedad", () => {
    const files = buildSpecKitBundleFiles({
      projectName: "Peludo",
      mddContent: "## 2. Stack\nFastify Railway.",
      tasksContent:
        "- [ ] Suite de pruebas sintéticas** por agente (50 casos) y modo sombra para validar cambios.\n- [ ] [P] Implementar login",
      specContent: `# Spec
3. Criterios de éxito
- Criterio de éxito: login funcional.
- (No se identifican marcadores de ambigüedad en ninguna sección.)*
`,
    });
    const quickstart = files.find((f) => f.path.endsWith("quickstart.md"))!.content;
    assert.doesNotMatch(quickstart, /3\. Criterios de éxito/);
    assert.doesNotMatch(quickstart, /ambigu/i);
    assert.doesNotMatch(quickstart, /Suite de pruebas sintéticas/);
    assert.match(quickstart, /login funcional/);
  });
});

describe("tasks-parse", () => {
  it("parseTasksMarkdown extrae checklist", () => {
    const md = `## Backend tasks\n- [ ] Crear API\n- [x] Hecho\n`;
    const items = parseTasksMarkdown(md);
    assert.equal(items.length, 2);
    assert.equal(items[0].done, false);
    assert.equal(items[1].done, true);
    assert.equal(items[0].section, "Backend tasks");
  });

  it("parseTasksMarkdown detecta [P] y rutas", () => {
    const md = `## US-1 Login\n**Checkpoint**: smoke login\n- [ ] [P] Crear vista \`src/pages/Login.tsx\`\n`;
    const items = parseTasksMarkdown(md);
    assert.equal(items.length, 1);
    assert.equal(items[0].parallel, true);
    assert.ok(items[0].filePaths.includes("src/pages/Login.tsx"));
    assert.equal(items[0].checkpoint, "smoke login");
  });
});
