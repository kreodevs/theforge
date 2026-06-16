import { describe, it } from "node:test";
import assert from "node:assert";
import {
  inferStacks,
  suggestAgentGovernanceArtifacts,
} from "./suggest-agent-governance-artifacts.js";
import { parseAgentGovernanceResponse } from "./agent-governance.util.js";

const NEST_REACT_MDD = `
# MDD Proyecto Demo

## 2. Stack técnico
- Backend: NestJS con TypeScript
- Frontend: React 18 + Vite
- Monorepo con packages/api y packages/web

## 4. Contratos de API
REST con validación Zod y OpenAPI.

## 6. Seguridad
JWT y OAuth2 para sesiones.
`;

const ARIADNE_LEGACY_MDD = `
# MDD Legacy

## 1. Contexto
Integración MCP Ariadne para análisis de código legacy existente.
Proyecto strangler fig sobre monolito.

## 2. Stack
Backend Express, refactor incremental.
`;

describe("suggestAgentGovernanceArtifacts", () => {
  it("MDD NestJS+React MEDIUM sugiere stack-backend, stack-frontend y orchestrator", () => {
    const result = suggestAgentGovernanceArtifacts({
      mddMarkdown: NEST_REACT_MDD,
      complexity: "MEDIUM",
    });
    const ruleIds = result.suggestedRules.map((r) => r.id);
    assert.ok(ruleIds.includes("stack-backend"), `rules: ${ruleIds.join(",")}`);
    assert.ok(ruleIds.includes("stack-frontend"));
    assert.ok(ruleIds.includes("orchestrator"));
    assert.ok(ruleIds.includes("api-contracts"));
    assert.ok(result.archetypes.includes("nestjs-react-monorepo"));
  });

  it("MDD con Ariadne sugiere skill mcp-ariadne y rule mcp-governance", () => {
    const result = suggestAgentGovernanceArtifacts({
      mddMarkdown: ARIADNE_LEGACY_MDD,
      complexity: "MEDIUM",
    });
    const skillIds = result.suggestedSkills.map((s) => s.id);
    const ruleIds = result.suggestedRules.map((r) => r.id);
    assert.ok(skillIds.includes("mcp-ariadne"), `skills: ${skillIds.join(",")}`);
    assert.ok(ruleIds.includes("mcp-governance"), `rules: ${ruleIds.join(",")}`);
    assert.ok(result.archetypes.includes("legacy-ariadne"));
  });

  it("LOW limita a pocas rules y sin skills", () => {
    const result = suggestAgentGovernanceArtifacts({
      mddMarkdown: NEST_REACT_MDD,
      complexity: "LOW",
    });
    assert.ok(result.suggestedRules.length <= 2);
    assert.equal(result.suggestedSkills.length, 0);
    assert.ok(result.rationale.some((r) => /LOW/i.test(r)));
  });

  it("HIGH monorepo sugiere más skills (domain + monorepo)", () => {
    const result = suggestAgentGovernanceArtifacts({
      mddMarkdown: NEST_REACT_MDD + "\nDesign system en packages/ui con Storybook.\n",
      complexity: "HIGH",
    });
    const skillIds = result.suggestedSkills.map((s) => s.id);
    assert.ok(skillIds.includes("domain-package"));
    assert.ok(
      skillIds.includes("monorepo-packages") || skillIds.includes("design-system-ui"),
      `skills: ${skillIds.join(",")}`,
    );
    assert.ok(
      result.rationale.some((r) => /monorepo|HIGH/i.test(r)),
      "debe mencionar monorepo o HIGH",
    );
  });
});

describe("inferStacks", () => {
  it("detecta Expo, Cloudflare Workers, Hono y FastAPI", () => {
    assert.equal(inferStacks("Mobile app con Expo SDK 52").mobile, "Expo");
    assert.equal(inferStacks("Backend: Cloudflare Workers con Hono").backend, "Cloudflare Workers");
    assert.equal(inferStacks("API en FastAPI con Python").backend, "FastAPI");
    assert.equal(inferStacks("Despliegue serverless en Cloudflare").infra, "Serverless");
  });
});

describe("suggestAgentGovernanceArtifacts con Tasks y Architecture", () => {
  it("usa Tasks y Architecture en rationale y facts", () => {
    const result = suggestAgentGovernanceArtifacts({
      mddMarkdown: NEST_REACT_MDD,
      blueprintMarkdown: "## Módulos\n- `apps/api`\n- `apps/mobile`\n",
      tasksMarkdown: "## Fase 1\n### Configurar monorepo\n",
      architectureMarkdown: "## Capa API\n## Capa UI\n",
      complexity: "HIGH",
    });
    assert.ok(result.rationale.some((r) => /Tasks disponibles/i.test(r)));
  });
});

describe("parseAgentGovernanceResponse + sugerencias", () => {
  it("añade rules omitidas por el LLM desde catálogo (strong y weak)", () => {
    const suggestions = suggestAgentGovernanceArtifacts({
      mddMarkdown: NEST_REACT_MDD,
      complexity: "MEDIUM",
    });
    const raw = JSON.stringify({
      files: {
        "AGENTS.md": "# AGENTS\n",
        "CLAUDE.md": "@AGENTS.md\n",
      },
    });
    const scaffold = parseAgentGovernanceResponse(raw, "MEDIUM", {
      suggestions,
      governanceInput: {
        mddMarkdown: NEST_REACT_MDD,
        complexity: "MEDIUM",
      },
    });
    const paths = scaffold.files.map((f) => f.path);
    assert.ok(
      paths.includes("docs/agent-governance/rules/stack-backend.mdc"),
      `paths: ${paths.filter((p) => p.includes("rules")).join(",")}`,
    );
    assert.ok(
      paths.includes("docs/agent-governance/rules/orchestrator.mdc"),
      `orchestrator weak también debe materializarse; rules: ${paths.filter((p) => p.includes("rules")).join(",")}`,
    );
    assert.ok(scaffold.manifest.suggestions?.archetypes.includes("nestjs-react-monorepo"));
    const comoUsar = scaffold.files.find(
      (f) => f.path === "docs/agent-governance/COMO-USAR-GOBERNANZA-IA.md",
    );
    assert.ok(comoUsar?.content.includes("Por qué se incluyeron estos skills/rules"));
    assert.ok(paths.includes("PROMPT-INICIAL.md"));
    assert.ok(paths.includes("docs/sdd/PROGRESO.md"));
  });
});
