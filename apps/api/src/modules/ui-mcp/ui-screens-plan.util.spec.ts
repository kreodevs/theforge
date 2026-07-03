import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPantallasPlan,
  entityMatchTokens,
  inferUiHintFromText,
  parseUserStoriesMarkdown,
  storyMatchesEntity,
} from "./ui-screens-plan.util.js";

const SAMPLE_HU = [
  "## Epic: Multi-tenant",
  "",
  "### Historia de usuario: [US-010] Gestionar tenants",
  "",
  "### 🧾 Historia de Usuario",
  "",
  "**Como:** Administrador de plataforma",
  "**Quiero:** crear y administrar tenants",
  "**Para:** aislar datos por cliente",
  "",
  "### Historia de usuario: [US-020] Dashboard ejecutivo",
  "",
  "### 🧾 Historia de Usuario",
  "",
  "**Como:** Director comercial",
  "**Quiero:** ver un panel con métricas de ventas",
  "**Para:** tomar decisiones rápidas",
].join("\n");

const SAMPLE_MDD = [
  "## 3. Modelo de Datos",
  "",
  "CREATE TABLE tenants (id UUID PRIMARY KEY);",
  "CREATE TABLE users (id UUID PRIMARY KEY, tenant_id UUID);",
].join("\n");

describe("ui-screens-plan — parseUserStoriesMarkdown", () => {
  it("extrae Como/Quiero/Para de plantilla The Forge", () => {
    const stories = parseUserStoriesMarkdown(SAMPLE_HU);
    assert.equal(stories.length, 2);
    assert.equal(stories[0].id, "US-010");
    assert.match(stories[0].want ?? "", /tenants/i);
    assert.equal(stories[1].id, "US-020");
    assert.match(stories[1].want ?? "", /panel/i);
  });
});

describe("ui-screens-plan — storyMatchesEntity", () => {
  it("vincula HU con nombre de tabla y variantes", () => {
    const story = parseUserStoriesMarkdown(SAMPLE_HU)[0];
    assert.ok(story);
    assert.ok(storyMatchesEntity(story, "tenants"));
    assert.ok(!storyMatchesEntity(story, "invoices"));
  });

  it("genera tokens singular/plural", () => {
    assert.ok(entityMatchTokens("tenants").includes("tenant"));
    assert.ok(entityMatchTokens("orders").includes("order"));
  });
});

describe("ui-screens-plan — inferUiHintFromText", () => {
  it("detecta kanban, form y dashboard", () => {
    assert.equal(inferUiHintFromText("mover tarjetas en el tablero kanban"), "kanban");
    assert.equal(inferUiHintFromText("formulario de alta de cliente"), "form");
    assert.equal(inferUiHintFromText("panel con métricas KPI"), "dashboard");
  });
});

describe("ui-screens-plan — buildPantallasPlan", () => {
  it("enriquece entidades §3 con HU y añade pantallas hu-only", () => {
    const plan = buildPantallasPlan(SAMPLE_MDD, SAMPLE_HU);
    assert.equal(plan.length, 3);

    const tenants = plan.find((p) => p.name === "tenants");
    assert.ok(tenants);
    assert.equal(tenants.source, "entity+hu");
    assert.match(tenants.screenName, /tenants/i);
    assert.match(tenants.purpose, /Como:/);
    assert.equal(tenants.uiHint, "form");

    const users = plan.find((p) => p.name === "users");
    assert.ok(users);
    assert.equal(users.source, "entity");

    const dashboard = plan.find((p) => p.source === "hu-only");
    assert.ok(dashboard);
    assert.match(dashboard.screenName, /Dashboard/i);
    assert.equal(dashboard.uiHint, "dashboard");
  });

  it("funciona sin historias (solo §3)", () => {
    const plan = buildPantallasPlan(SAMPLE_MDD, null);
    assert.equal(plan.length, 2);
    assert.ok(plan.every((p) => p.source === "entity"));
  });
});
