import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildJourneyEndpointRequirements,
  checkMddJourneySection4Gaps,
  injectMissingJourneyEndpointsIntoMddSection4,
} from "./mdd-journey-section4.util.js";

const MDD = `
## 2. Stack y Arquitectura
Gateway WebSocket para cotizaciones en tiempo real (wss://).

## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE watchlists (id UUID PRIMARY KEY);
CREATE TABLE strategies (id UUID PRIMARY KEY);
CREATE TABLE credentials (id UUID PRIMARY KEY);
CREATE TABLE dashboard_configs (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API

| Método | Ruta | Descripción | Auth | Notas |
|--------|------|-------------|------|-------|
| GET | \`/api/v1/operations\` | Ops | Bearer | MVP |
`;

describe("mdd-journey-section4.util", () => {
  it("requires CRUD + dashboard/me + quota + WS when entities present", () => {
    const reqs = buildJourneyEndpointRequirements({ mddMarkdown: MDD });
    const ids = new Set(reqs.map((r) => r.id));
    assert.ok(ids.has("watchlists-list"));
    assert.ok(ids.has("strategies-list"));
    assert.ok(ids.has("credentials-list"));
    assert.ok(ids.has("dashboard-me"));
    assert.ok(ids.has("tenant-quota"));
    assert.ok(ids.has("ws-gateway"));
  });

  it("detects missing journey endpoints in §4", () => {
    const report = checkMddJourneySection4Gaps({ mddMarkdown: MDD });
    assert.ok(report.missing.length > 5);
    assert.match(report.gaps[0] ?? "", /\[MDD §4\]/);
  });

  it("injects missing endpoints into §4 table", () => {
    const report = checkMddJourneySection4Gaps({ mddMarkdown: MDD });
    const dashboard = report.missing.find((m) => m.id === "dashboard-me");
    assert.ok(dashboard);
    const { markdown, injected } = injectMissingJourneyEndpointsIntoMddSection4(MDD, [dashboard!]);
    assert.deepEqual(injected, ["dashboard-me"]);
    assert.match(markdown, /dashboards\/me/);
  });
});
