import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assessMermaidFixStrategy,
  repairMermaidBlockForRender,
} from "./mermaid-fix.util.js";

const BROKEN_LICENSE_FLOW = `sequenceDiagram
    par ticipant User as Cliente
    par ticipant Web as Portal Web
    par ticipant Stripe as Stripe/Payment
    par ticipant DB as Portal DB
    par ticipant Core as The Forge Core
    par ticipant Plugin as Plugin Comercial
  end
  end
  end
  end
  end
  end
User->>Web: Selecciona tier
    Web->>Stripe: Crear Checkout Session
    Stripe-->>User: Redirect a pago
    User->>Stripe: Completa pago
    Stripe-->>Web: Webhook payment_intent.succeeded
    Web->>DB: Crear License (status: active)
    DB-->>Web: License creada + API Key
    Web->>User: Mostrar API Key + instrucciones
    User->>Core: Configura PLUGIN_LICENSE_KEY en .env
    Core->>Plugin: onPluginInit()
    Plugin->>Web: POST /licenses/validate
    Web->>DB: Validar API Key + tier + fechas`;

describe("assessMermaidFixStrategy", () => {
  it("repara localmente par ticipant y ends huérfanos cuando la validación pasa", () => {
    const assessment = assessMermaidFixStrategy(BROKEN_LICENSE_FLOW);
    assert.equal(assessment.strategy, "repair");
    assert.ok(assessment.reasons.includes("participant_keyword_split"));
    assert.ok(assessment.reasons.includes("orphan_end_lines"));
  });
});

describe("repairMermaidBlockForRender", () => {
  it("corrige par ticipant y elimina end huérfanos localmente", () => {
    const out = repairMermaidBlockForRender(BROKEN_LICENSE_FLOW);
    assert.match(out, /participant User as Cliente/i);
    assert.doesNotMatch(out, /par ticipant/i);
    assert.equal(out.match(/^\s*end\s*$/gim)?.length ?? 0, 0);
  });
});
